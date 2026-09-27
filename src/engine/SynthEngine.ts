import * as Tone from "tone";
import {
  getScalePitchNotes,
  getScaleDegreePitch,
  getScaleDegreeChordPitches,
  pitchToMidiNumber,
  midiNumberToPitch
} from "@mrjoshida/music-theory";
import { PolyVoice } from "../voices/PolyVoice";
import { FMVoice } from "../voices/FMVoice";
import { PluckVoice } from "../voices/PluckVoice";
import { MoogVoice } from "../voices/MoogVoice";
import { DroneVoice } from "../voices/DroneVoice";
import { MembraneVoice } from "../voices/MembraneVoice";
import { SamplerVoice } from "../voices/SamplerVoice";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";
import { FxRack } from "../effects/FxRack";
import { WebMidiManager } from "../midi/WebMidiManager";
import { MidiFileEncoder } from "../midi/MidiFileEncoder";
import { PresetManager } from "../presets/PresetManager";
import { SynthEngineType, SynthEngineInitOptions, MidiNoteEvent, SynthPatch, FxConfig } from "../types";

export class SynthEngine {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  /** Bumped by dispose() so an initialization still in flight knows it was cancelled. */
  private initGeneration = 0;

  // Voices
  public polyVoice = new PolyVoice();
  public fmVoice = new FMVoice();
  public pluckVoice = new PluckVoice();
  public moogVoice = new MoogVoice();
  public droneVoice = new DroneVoice();
  public membraneVoice = new MembraneVoice();
  public samplerVoice = new SamplerVoice();

  // FX & MIDI
  public fxRack = new FxRack();
  public webMidi = new WebMidiManager();
  public presets = new PresetManager();

  // Recording Buffer
  private sessionEvents: MidiNoteEvent[] = [];
  private sessionStartTime: number = 0;

  // Audio State Listeners
  private audioStateListeners: Set<(state: "suspended" | "running" | "closed" | "interrupted") => void> = new Set();
  private attachedAudioContext: AudioContext | null = null;
  private audioContextHandler: (() => void) | null = null;

  /**
   * Builds the audio graph (FX rack and voices). `noteOn`/`noteOff` are ignored until this
   * resolves. Safe to call repeatedly or concurrently: callers share one initialization, and
   * a failed initialization can be retried. Call it from a user gesture so audio can start.
   *
   * @param opts.latencyHint AudioContext latency hint, applied only while audio is not yet running.
   * @param opts.lookAhead Tone.js scheduling look-ahead in seconds. Use `0` for live play: notes are
   *   triggered "now", and Tone's default look-ahead (0.1 s) would delay every note by that much.
   *   Keep a look-ahead if you schedule sequences on the Transport.
   * @param opts.webMidi Pass `false` when the host app manages Web MIDI itself. Skips the engine's
   *   own MIDI access request and its permission prompt. Defaults to `true`.
   */
  public init(opts?: SynthEngineInitOptions): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.initAudioGraph(opts).catch((err: unknown) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async initAudioGraph(opts?: SynthEngineInitOptions): Promise<void> {
    const generation = this.initGeneration;
    if (opts?.latencyHint !== undefined && ("getContext" in Tone) && ("setContext" in Tone) && typeof (Tone as any).getContext === "function" && typeof (Tone as any).setContext === "function") {
      const currentContext = (Tone as any).getContext();
      if (currentContext && currentContext.state !== "running") {
        (Tone as any).setContext(new Tone.Context({ latencyHint: opts.latencyHint as any }));
      }
    }

    const lookAhead = opts?.lookAhead;
    if (typeof lookAhead === "number" && Number.isFinite(lookAhead) && lookAhead >= 0 && ("getContext" in Tone) && typeof (Tone as any).getContext === "function") {
      const context = (Tone as any).getContext();
      if (context) {
        context.lookAhead = lookAhead;
      }
    }

    this.ensureAudioContextListener();

    // dispose() bumps initGeneration. Stop at the first await it interrupts, so a cancelled
    // initialization never touches the graph again (a newer init() may already be wiring it).
    const cancelled = () => generation !== this.initGeneration;

    if (typeof (Tone as any).start === "function") {
      await Tone.start();
      if (cancelled()) return;
    }
    await this.fxRack.init();
    if (cancelled()) return;

    const fxInput = this.fxRack.getInput();
    const voices = [
      this.polyVoice,
      this.fmVoice,
      this.pluckVoice,
      this.moogVoice,
      this.droneVoice,
      this.membraneVoice,
      this.samplerVoice,
    ];
    for (const voice of voices) {
      await voice.init();
      if (cancelled()) return;
      // Disconnect first: a retried init must not add a second route (Web Audio does not dedupe).
      voice.disconnect();
      voice.connect(fxInput);
    }

    if (opts?.webMidi !== false) {
      await this.webMidi.init();
      if (cancelled()) return;
    }

    this.sessionStartTime = Tone.now();
    this.initialized = true;
  }

  public async unlock(): Promise<boolean> {
    try {
      if (("start" in Tone) && typeof (Tone as any).start === "function") {
        await Tone.start();
      }
      if (("getContext" in Tone) && typeof (Tone as any).getContext === "function") {
        const toneCtx = (Tone as any).getContext();
        const raw = toneCtx?.rawContext as AudioContext | undefined;
        if (raw && "resume" in raw && (raw as AudioContext).state !== "running") {
          await (raw as AudioContext).resume();
        }
      }
      return this.getAudioState() === "running";
    } catch {
      return false;
    }
  }

  public async resume(): Promise<void> {
    if (("start" in Tone) && typeof (Tone as any).start === "function") {
      await Tone.start();
    }
    if (("getContext" in Tone) && typeof (Tone as any).getContext === "function") {
      const toneCtx = (Tone as any).getContext();
      const raw = toneCtx?.rawContext as AudioContext | undefined;
      if (raw && "resume" in raw && (raw as AudioContext).state !== "running") {
        await (raw as AudioContext).resume();
      }
    }
  }

  public getAudioState(): "suspended" | "running" | "closed" | "interrupted" {
    if (!("getContext" in Tone) || typeof (Tone as any).getContext !== "function") {
      return "suspended";
    }
    const toneCtx = (Tone as any).getContext();
    const raw = toneCtx?.rawContext as AudioContext | undefined;
    const state = (raw?.state ?? toneCtx?.state) as string;
    if (state === "running" || state === "suspended" || state === "closed" || state === "interrupted") {
      return state;
    }
    return "suspended";
  }

  public onAudioStateChange(
    cb: (state: "suspended" | "running" | "closed" | "interrupted") => void
  ): () => void {
    this.audioStateListeners.add(cb);
    this.ensureAudioContextListener();

    return () => {
      this.audioStateListeners.delete(cb);
      if (this.audioStateListeners.size === 0 && this.attachedAudioContext && this.audioContextHandler) {
        if (typeof this.attachedAudioContext.removeEventListener === "function") {
          this.attachedAudioContext.removeEventListener("statechange", this.audioContextHandler);
        }
        this.attachedAudioContext = null;
        this.audioContextHandler = null;
      }
    };
  }

  private ensureAudioContextListener(): void {
    if (this.audioStateListeners.size === 0) return;
    if (!("getContext" in Tone) || typeof (Tone as any).getContext !== "function") return;
    const toneCtx = (Tone as any).getContext();
    if (!toneCtx) return;
    const raw = toneCtx.rawContext as AudioContext | undefined;
    if (!raw || typeof raw.addEventListener !== "function") return;

    if (this.attachedAudioContext !== raw) {
      if (this.attachedAudioContext && this.audioContextHandler && typeof this.attachedAudioContext.removeEventListener === "function") {
        this.attachedAudioContext.removeEventListener("statechange", this.audioContextHandler);
      }
      this.attachedAudioContext = raw;
      this.audioContextHandler = () => {
        const state = this.getAudioState();
        this.audioStateListeners.forEach((listener) => {
          try {
            listener(state);
          } catch (e) {
            console.error("Error in audio state listener:", e);
          }
        });
      };
      raw.addEventListener("statechange", this.audioContextHandler);
    }
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public getVoice(type: SynthEngineType) {
    switch (type) {
      case "poly": return this.polyVoice;
      case "fm": return this.fmVoice;
      case "pluck": return this.pluckVoice;
      case "moog": return this.moogVoice;
      case "drone": return this.droneVoice;
      case "membrane": return this.membraneVoice;
      case "sampler": return this.samplerVoice;
    }
  }

  /**
   * Triggers a sustained note-on event on the specified voice and forwards to Web MIDI.
   *
   * Note on caller responsibility: The caller is responsible for refcounting or deduplicating
   * duplicate noteOn calls for the same pitch (e.g. across multiple overlapping pads or keys in Fretmancer)
   * before calling noteOff.
   *
   * @param note MIDI note number (0-127) or pitch notation string (e.g. 'C4')
   * @param velocity Note velocity normalized to 0..1 (default: 0.8)
   * @param opts Optional configuration for voiceType (default: 'poly') and MIDI channel (default: 1)
   */
  public noteOn(
    note: number | string,
    velocity: number = 0.8,
    opts?: { voiceType?: SynthEngineType; channel?: number }
  ): void {
    if (!this.initialized) return;

    const voiceType = opts?.voiceType ?? "poly";
    const channel = opts?.channel ?? 1;

    let pitch: string;
    let midiNum: number;

    if (typeof note === "number") {
      midiNum = Math.max(0, Math.min(127, Math.round(note)));
      pitch = midiNumberToPitch(midiNum);
    } else {
      pitch = note;
      midiNum = pitchToMidiNumber(note);
    }

    const clampedVelocity = Math.max(0, Math.min(1, velocity));
    const voice = this.getVoice(voiceType);
    voice.triggerAttack(pitch, undefined, clampedVelocity);

    this.webMidi.sendNoteOn(midiNum, clampedVelocity, channel);
  }

  /**
   * Releases a sustained note on the specified voice and forwards to Web MIDI.
   *
   * @param note MIDI note number (0-127) or pitch notation string (e.g. 'C4')
   * @param opts Optional configuration for voiceType (default: 'poly') and MIDI channel (default: 1)
   */
  public noteOff(
    note: number | string,
    opts?: { voiceType?: SynthEngineType; channel?: number }
  ): void {
    if (!this.initialized) return;

    const voiceType = opts?.voiceType ?? "poly";
    const channel = opts?.channel ?? 1;

    let pitch: string;
    let midiNum: number;

    if (typeof note === "number") {
      midiNum = Math.max(0, Math.min(127, Math.round(note)));
      pitch = midiNumberToPitch(midiNum);
    } else {
      pitch = note;
      midiNum = pitchToMidiNumber(note);
    }

    const voice = this.getVoice(voiceType);
    voice.triggerRelease(pitch);

    this.webMidi.sendNoteOff(midiNum, channel);
  }

  /**
   * Releases all active voices across all 7 engine types.
   *
   * @param time Optional release time scheduling
   */
  public releaseAll(time?: any): void {
    const voices = [
      this.polyVoice,
      this.fmVoice,
      this.pluckVoice,
      this.moogVoice,
      this.droneVoice,
      this.membraneVoice,
      this.samplerVoice
    ];
    for (const v of voices) {
      try {
        v.triggerRelease(undefined, time);
      } catch (e) {
        console.warn("Error releasing voice:", e);
      }
    }
  }

  /**
   * Emergency panic: immediately silences all 7 voices at Tone.now() and sends all-notes-off CCs.
   */
  public panic(): void {
    this.releaseAll(Tone.now());
    this.webMidi.allNotesOff();
  }

  public playNote(
    note: string,
    duration: string = "8n",
    velocity: number = 0.8,
    voiceType: SynthEngineType = "poly",
    channel: number = 1
  ): void {
    if (!this.initialized) return;
    const voice = this.getVoice(voiceType);
    voice.triggerAttackRelease(note, duration, undefined, velocity);

    // Web MIDI & Recording
    const midiNum = pitchToMidiNumber(note);
    const durSec = Tone.Time(duration).toSeconds();
    this.webMidi.sendNoteOn(midiNum, velocity, channel);
    setTimeout(() => this.webMidi.sendNoteOff(midiNum, channel), durSec * 1000);

    this.recordEvent({
      note,
      time: Tone.Transport.state === "started" ? Tone.Transport.seconds : Tone.now() - this.sessionStartTime,
      duration: durSec,
      velocity,
      channel
    });
  }

  public playChord(
    notes: string[],
    duration: string = "2n",
    velocity: number = 0.8,
    voiceType: SynthEngineType = "poly",
    channel: number = 1
  ): void {
    if (!this.initialized) return;
    const voice = this.getVoice(voiceType);
    voice.triggerAttackRelease(notes, duration, undefined, velocity);

    const durSec = Tone.Time(duration).toSeconds();
    notes.forEach((n) => {
      const midiNum = pitchToMidiNumber(n);
      this.webMidi.sendNoteOn(midiNum, velocity, channel);
      setTimeout(() => this.webMidi.sendNoteOff(midiNum, channel), durSec * 1000);

      this.recordEvent({
        note: n,
        time: Tone.Transport.state === "started" ? Tone.Transport.seconds : Tone.now() - this.sessionStartTime,
        duration: durSec,
        velocity,
        channel
      });
    });
  }

  public playScaleDegree(
    rootKey: string,
    scale: string,
    degree: number,
    octave: number = 4,
    duration: string = "8n",
    velocity: number = 0.8,
    voiceType: SynthEngineType = "poly"
  ): void {
    const note = getScaleDegreePitch(rootKey, scale, degree, octave);
    this.playNote(note, duration, velocity, voiceType);
  }

  public playChordVoicing(
    rootKey: string,
    scale: string,
    degree: number,
    octave: number = 3,
    useSevenths: boolean = true,
    duration: string = "2n",
    velocity: number = 0.8,
    voiceType: SynthEngineType = "poly"
  ): void {
    const chordPitches = getScaleDegreeChordPitches(rootKey, scale, degree, octave, useSevenths);
    this.playChord(chordPitches, duration, velocity, voiceType);
  }

  public async loadInstrument(instrumentId: string): Promise<void> {
    const config = BUILTIN_INSTRUMENTS[instrumentId];
    if (!config) {
      throw new Error(`Instrument not found: ${instrumentId}`);
    }
    await this.samplerVoice.loadInstrument(config);
  }

  public loadPatch(patch: SynthPatch): void {
    if (patch.samplerConfig) {
      this.loadInstrument(patch.samplerConfig.instrumentId);
    }
    const voice = this.getVoice(patch.engineType);
    voice.applyPatch(patch);
    
    // Always reset baseline FX sends first, then apply patch-specific sends
    const baselineSends: Partial<FxConfig> = {
      reverbWet: 0.15,
      reverbDecay: 3.75,
      chorusWet: 0.0,
      chorusFrequency: 1.5,
      chorusDepth: 0.6,
      delayWet: 0.0,
      delayTime: "8n.",
      delayFeedback: 0.3,
      masterVolume: 0.85
    };
    this.fxRack.setConfig({ ...baselineSends, ...(patch.fxSends || {}) });
  }

  public startTransport(): void {
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
  }

  public stopTransport(): void {
    Tone.Transport.stop();
  }

  public setBpm(bpm: number): void {
    Tone.Transport.bpm.value = Math.max(30, Math.min(300, bpm));
  }

  public setSwing(swing: number): void {
    Tone.Transport.swing = Math.max(0, Math.min(0.5, (swing - 50) / 50));
    Tone.Transport.swingSubdivision = "8n";
  }

  public exportMidiBlob(bpm: number = 120, title: string = "Orbis Sequence"): Blob {
    const buffer = MidiFileEncoder.createStandardMidiFile(this.sessionEvents, bpm, title);
    return new Blob([buffer], { type: "audio/midi" });
  }

  public getSessionEvents(): MidiNoteEvent[] {
    return [...this.sessionEvents];
  }

  public clearSessionEvents(): void {
    this.sessionEvents = [];
    this.sessionStartTime = Tone.now();
  }

  private recordEvent(ev: MidiNoteEvent): void {
    if (this.sessionEvents.length > 1000) {
      this.sessionEvents.shift();
    }
    this.sessionEvents.push(ev);
  }

  public dispose(): void {
    if (this.attachedAudioContext && this.audioContextHandler) {
      if (typeof this.attachedAudioContext.removeEventListener === "function") {
        this.attachedAudioContext.removeEventListener("statechange", this.audioContextHandler);
      }
      this.attachedAudioContext = null;
      this.audioContextHandler = null;
    }
    this.audioStateListeners.clear();

    this.polyVoice.dispose();
    this.fmVoice.dispose();
    this.pluckVoice.dispose();
    this.moogVoice.dispose();
    this.droneVoice.dispose();
    this.membraneVoice.dispose();
    this.samplerVoice.dispose();
    this.fxRack.dispose();
    this.initialized = false;
    this.initPromise = null;
    this.initGeneration++;
  }
}

export const sharedSynthEngine = new SynthEngine();
