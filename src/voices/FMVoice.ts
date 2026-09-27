/**
 * @file FMVoice implementation with Tone.PolySynth and Tone.FMSynth.
 */

import * as Tone from "tone";
import { BaseVoice, ApplyPatchOptions } from "./Voice";
import { SynthPatch } from "../types";
import { toToneOscillator, setToneParam } from "./helpers";
import { getEffectiveParam } from "../params/patch";

export class FMVoice extends BaseVoice {
  private fmPoly: Tone.PolySynth<Tone.FMSynth> | null = null;
  private filter: Tone.Filter | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.filter = new Tone.Filter({
      frequency: 8000,
      type: "lowpass",
      rolloff: -12,
      Q: 1.5,
    });

    this.fmPoly = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 12,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.002,
        decay: 0.8,
        sustain: 0.1,
        release: 1.2,
      },
      modulation: { type: "triangle" },
      modulationEnvelope: {
        attack: 0.005,
        decay: 0.5,
        sustain: 0.05,
        release: 0.8,
      },
    });

    this.fmPoly.connect(this.filter);
    this.filter.connect(this.outputNode);

    this.isInitialized = true;
  }

  public triggerAttackRelease(
    note: string | string[],
    duration: string | number,
    time?: number,
    velocity: number = 0.8
  ): void {
    if (!this.fmPoly) return;
    try {
      this.fmPoly.triggerAttackRelease(note, duration, time, velocity);
    } catch (e) {
      console.error("FMVoice trigger error:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.8): void {
    if (!this.fmPoly) return;
    this.fmPoly.triggerAttack(note, time, velocity);
  }

  public triggerRelease(note?: string | string[], time?: number): void {
    if (!this.fmPoly) return;
    const hasNote = note !== undefined && (!Array.isArray(note) || note.length > 0);
    if (hasNote) {
      this.fmPoly.triggerRelease(note!, time);
    } else {
      this.clearKeyMap();
      this.fmPoly.releaseAll(time);
    }
  }

  public applyPatch(patch: SynthPatch, opts?: ApplyPatchOptions): void {
    if (!this.fmPoly) return;
    const smooth = opts?.smooth ?? false;

    // Carrier oscillator
    const oscConfig = toToneOscillator({
      type: getEffectiveParam(patch, "oscillator.type") as any,
      count: patch.oscillator?.count,
      spread: patch.oscillator?.spread,
    });
    (this.fmPoly as any).set({
      oscillator: oscConfig,
    });

    // Carrier envelope
    const attack = Number(getEffectiveParam(patch, "envelope.attack"));
    const decay = Number(getEffectiveParam(patch, "envelope.decay"));
    const sustain = Number(getEffectiveParam(patch, "envelope.sustain"));
    const release = Number(getEffectiveParam(patch, "envelope.release"));

    (this.fmPoly as any).set({
      envelope: { attack, decay, sustain, release },
    });

    // FM parameters
    const harmonicity = Number(getEffectiveParam(patch, "fmParams.harmonicity"));
    const modulationIndex = Number(getEffectiveParam(patch, "fmParams.modulationIndex"));
    const modType = String(getEffectiveParam(patch, "fmParams.modulationType"));

    const modAtt = Number(getEffectiveParam(patch, "fmParams.modulationEnvelope.attack"));
    const modDec = Number(getEffectiveParam(patch, "fmParams.modulationEnvelope.decay"));
    const modSus = Number(getEffectiveParam(patch, "fmParams.modulationEnvelope.sustain"));
    const modRel = Number(getEffectiveParam(patch, "fmParams.modulationEnvelope.release"));

    (this.fmPoly as any).set({
      harmonicity,
      modulationIndex,
      modulation: { type: modType },
      modulationEnvelope: {
        attack: modAtt,
        decay: modDec,
        sustain: modSus,
        release: modRel,
      },
    });

    // Filter
    if (this.filter) {
      const freq = Number(getEffectiveParam(patch, "filter.frequency"));
      const fType = String(getEffectiveParam(patch, "filter.type"));
      const rolloff = Number(getEffectiveParam(patch, "filter.rolloff"));
      const q = Number(getEffectiveParam(patch, "filter.Q"));

      setToneParam(this.filter.frequency, freq, smooth);
      if (this.filter.type !== fType) {
        this.filter.type = fType as any;
      }
      if (rolloff !== undefined && !Number.isNaN(rolloff)) {
        if (this.filter.rolloff !== rolloff) {
          this.filter.rolloff = rolloff as any;
        }
      }
      if (q !== undefined && !Number.isNaN(q)) {
        setToneParam(this.filter.Q, q, smooth);
      }
    }
  }

  public dispose(): void {
    this.fmPoly?.dispose();
    this.filter?.dispose();
    this.outputNode?.dispose();
    this.fmPoly = null;
    this.filter = null;
    this.outputNode = null;
    this.clearKeyMap();
    this.isInitialized = false;
  }
}
