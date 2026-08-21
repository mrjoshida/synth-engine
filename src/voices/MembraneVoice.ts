import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

export class MembraneVoice extends BaseVoice {
  private membrane: Tone.MembraneSynth | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.membrane = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.8
      }
    });

    this.membrane.connect(this.outputNode);
    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity: number = 0.9): void {
    if (!this.membrane) return;
    try {
      const singleNote = Array.isArray(note) ? note[0] : note;
      this.membrane.triggerAttackRelease(singleNote, duration, time, velocity);
    } catch (e) {
      console.error("MembraneVoice trigger error:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.9): void {
    this.triggerAttackRelease(note, "8n", time, velocity);
  }

  public triggerRelease(_note?: string | string[], _time?: number): void {
    // Decays naturally
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.membrane) return;
    if (patch.membraneParams) {
      this.membrane.pitchDecay = patch.membraneParams.pitchDecay;
      this.membrane.octaves = patch.membraneParams.octaves;
    }
    if (patch.envelope) {
      this.membrane.envelope.set(patch.envelope);
    }
  }

  public dispose(): void {
    this.membrane?.dispose();
    this.outputNode?.dispose();
    this.membrane = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
