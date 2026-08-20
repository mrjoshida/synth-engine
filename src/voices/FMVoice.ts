import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

export class FMVoice extends BaseVoice {
  private fmPoly: Tone.PolySynth<Tone.FMSynth> | null = null;
  private filter: Tone.Filter | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.filter = new Tone.Filter({
      frequency: 8000,
      type: "lowpass",
      rolloff: -12
    });

    this.fmPoly = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 12,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.002,
        decay: 0.8,
        sustain: 0.1,
        release: 1.2
      },
      modulation: { type: "triangle" },
      modulationEnvelope: {
        attack: 0.005,
        decay: 0.5,
        sustain: 0.05,
        release: 0.8
      }
    });

    this.fmPoly.connect(this.filter);
    this.filter.connect(this.outputNode);

    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity: number = 0.8): void {
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

  public triggerRelease(time?: number): void {
    if (!this.fmPoly) return;
    this.fmPoly.releaseAll(time);
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.fmPoly) return;

    if (patch.fmParams) {
      (this.fmPoly as any).set({
        harmonicity: patch.fmParams.harmonicity,
        modulationIndex: patch.fmParams.modulationIndex,
        modulation: { type: patch.fmParams.modulationType },
        modulationEnvelope: patch.fmParams.modulationEnvelope
      });
    }

    if (patch.envelope) {
      (this.fmPoly as any).set({ envelope: patch.envelope });
    }

    if (patch.oscillator) {
      (this.fmPoly as any).set({ oscillator: { type: patch.oscillator.type } });
    }
  }

  public dispose(): void {
    this.fmPoly?.dispose();
    this.filter?.dispose();
    this.outputNode?.dispose();
    this.fmPoly = null;
    this.filter = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
