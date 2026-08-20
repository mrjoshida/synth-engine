import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

export class MoogVoice extends BaseVoice {
  private synth: Tone.MonoSynth | null = null;
  private saturation: Tone.Chebyshev | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);
    this.saturation = new Tone.Chebyshev(2);

    this.synth = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.015,
        decay: 0.35,
        sustain: 0.4,
        release: 0.6
      },
      filter: {
        Q: 4.5,
        type: "lowpass",
        rolloff: -24
      },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.25,
        sustain: 0.3,
        release: 0.8,
        baseFrequency: 180,
        octaves: 3.5,
        exponent: 2
      }
    });

    this.synth.chain(this.saturation, this.outputNode);
    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity: number = 0.85): void {
    if (!this.synth) return;
    try {
      const singleNote = Array.isArray(note) ? note[0] : note;
      this.synth.triggerAttackRelease(singleNote, duration, time, velocity);
    } catch (e) {
      console.error("MoogVoice trigger error:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.85): void {
    if (!this.synth) return;
    const singleNote = Array.isArray(note) ? note[0] : note;
    this.synth.triggerAttack(singleNote, time, velocity);
  }

  public triggerRelease(time?: number): void {
    if (!this.synth) return;
    this.synth.triggerRelease(time);
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.synth) return;

    if (patch.oscillator) {
      (this.synth as any).set({ oscillator: { type: patch.oscillator.type } });
    }

    if (patch.envelope) {
      (this.synth as any).set({ envelope: patch.envelope });
    }

    if (patch.filter) {
      (this.synth as any).set({
        filter: {
          frequency: patch.filter.frequency,
          Q: patch.filter.Q ?? 4.5
        }
      });
    }

    if (patch.moogParams && this.saturation) {
      this.saturation.order = Math.max(1, Math.min(10, Math.round(patch.moogParams.drive * 5)));
    }
  }

  public dispose(): void {
    this.synth?.dispose();
    this.saturation?.dispose();
    this.outputNode?.dispose();
    this.synth = null;
    this.saturation = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
