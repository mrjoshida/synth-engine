import * as Tone from "tone";
import {
  getScalePitchNotes,
  getScaleDegreePitch,
  getScaleDegreeChordPitches,
  pitchToMidiNumber
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
import { SynthEngineType, MidiNoteEvent, SynthPatch, FxConfig } from "../types";

export class SynthEngine {
  private initialized = false;

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

  public async init(): Promise<void> {
    if (this.initialized) return;

    await Tone.start();
    await this.fxRack.init();

    const fxInput = this.fxRack.getInput();

    await this.polyVoice.init();
    this.polyVoice.connect(fxInput);

    await this.fmVoice.init();
    this.fmVoice.connect(fxInput);

    await this.pluckVoice.init();
    this.pluckVoice.connect(fxInput);

    await this.moogVoice.init();
    this.moogVoice.connect(fxInput);

    await this.droneVoice.init();
    this.droneVoice.connect(fxInput);

    await this.membraneVoice.init();
    this.membraneVoice.connect(fxInput);

    await this.samplerVoice.init();
    this.samplerVoice.connect(fxInput);

    await this.webMidi.init();

    this.sessionStartTime = Tone.now();
    this.initialized = true;
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
    this.polyVoice.dispose();
    this.fmVoice.dispose();
    this.pluckVoice.dispose();
    this.moogVoice.dispose();
    this.droneVoice.dispose();
    this.membraneVoice.dispose();
    this.samplerVoice.dispose();
    this.fxRack.dispose();
    this.initialized = false;
  }
}

export const sharedSynthEngine = new SynthEngine();
