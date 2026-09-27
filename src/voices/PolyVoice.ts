/**
 * @file PolyVoice implementation with Tone.PolySynth.
 */

import * as Tone from "tone";
import { BaseVoice, ApplyPatchOptions } from "./Voice";
import { SynthPatch } from "../types";
import { toToneOscillator, setToneParam } from "./helpers";
import { getEffectiveParam } from "../params/patch";

export class PolyVoice extends BaseVoice {
  private polySynth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.filter = new Tone.Filter({
      frequency: 4500,
      type: "lowpass",
      rolloff: -24,
      Q: 1.5,
    });

    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.08,
        decay: 0.4,
        sustain: 0.3,
        release: 1.4,
      },
    });

    this.polySynth.connect(this.filter);
    this.filter.connect(this.outputNode);

    this.isInitialized = true;
  }

  public triggerAttackRelease(
    note: string | string[],
    duration: string | number,
    time?: number,
    velocity: number = 0.8
  ): void {
    if (!this.polySynth) return;
    try {
      this.polySynth.triggerAttackRelease(note, duration, time, velocity);
    } catch (e) {
      console.error("PolyVoice trigger error:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.8): void {
    if (!this.polySynth) return;
    this.polySynth.triggerAttack(note, time, velocity);
  }

  public triggerRelease(note?: string | string[], time?: number): void {
    if (!this.polySynth) return;
    const hasNote = note !== undefined && (!Array.isArray(note) || note.length > 0);
    if (hasNote) {
      this.polySynth.triggerRelease(note!, time);
    } else {
      this.clearKeyMap();
      this.polySynth.releaseAll(time);
    }
  }

  public applyPatch(patch: SynthPatch, opts?: ApplyPatchOptions): void {
    if (!this.polySynth || !this.filter) return;
    const smooth = opts?.smooth ?? false;

    // Oscillator configuration (unison stays raw)
    const oscConfig = toToneOscillator(patch.oscillator);
    (this.polySynth as any).set({
      oscillator: oscConfig,
    });

    // Envelope
    const attack = Number(getEffectiveParam(patch, "envelope.attack"));
    const decay = Number(getEffectiveParam(patch, "envelope.decay"));
    const sustain = Number(getEffectiveParam(patch, "envelope.sustain"));
    const release = Number(getEffectiveParam(patch, "envelope.release"));

    (this.polySynth as any).set({
      envelope: { attack, decay, sustain, release },
    });

    // Filter
    const freq = Number(getEffectiveParam(patch, "filter.frequency"));
    const fType = String(getEffectiveParam(patch, "filter.type"));
    const rolloff = Number(getEffectiveParam(patch, "filter.rolloff"));
    const q = Number(getEffectiveParam(patch, "filter.Q"));

    setToneParam(this.filter.frequency, freq, smooth);
    this.filter.type = fType as any;
    if (rolloff !== undefined && !Number.isNaN(rolloff)) {
      this.filter.rolloff = rolloff as any;
    }
    if (q !== undefined && !Number.isNaN(q)) {
      setToneParam(this.filter.Q, q, smooth);
    }
  }

  public dispose(): void {
    this.polySynth?.dispose();
    this.filter?.dispose();
    this.outputNode?.dispose();
    this.polySynth = null;
    this.filter = null;
    this.outputNode = null;
    this.clearKeyMap();
    this.isInitialized = false;
  }
}
