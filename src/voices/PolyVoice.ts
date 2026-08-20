import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

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
      Q: 1.5
    });

    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.08,
        decay: 0.4,
        sustain: 0.3,
        release: 1.4
      }
    });

    this.polySynth.connect(this.filter);
    this.filter.connect(this.outputNode);

    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity: number = 0.8): void {
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
    if (note) {
      this.polySynth.triggerRelease(note, time);
    } else {
      this.polySynth.releaseAll(time);
    }
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.polySynth || !this.filter) return;

    if (patch.oscillator) {
      (this.polySynth as any).set({
        oscillator: { type: patch.oscillator.type }
      });
    }

    if (patch.envelope) {
      (this.polySynth as any).set({
        envelope: {
          attack: patch.envelope.attack,
          decay: patch.envelope.decay,
          sustain: patch.envelope.sustain,
          release: patch.envelope.release
        }
      });
    }

    if (patch.filter) {
      this.filter.frequency.value = patch.filter.frequency;
      this.filter.type = patch.filter.type;
      if (patch.filter.Q) this.filter.Q.value = patch.filter.Q;
    }
  }

  public dispose(): void {
    this.polySynth?.dispose();
    this.filter?.dispose();
    this.outputNode?.dispose();
    this.polySynth = null;
    this.filter = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
