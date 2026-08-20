import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

export class PluckVoice extends BaseVoice {
  private pluck: Tone.PluckSynth | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.pluck = new Tone.PluckSynth({
      attackNoise: 1.2,
      dampening: 4200,
      resonance: 0.95
    });

    this.pluck.connect(this.outputNode);
    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], _duration: string | number, time?: number, _velocity: number = 0.85): void {
    if (!this.pluck) return;
    try {
      if (Array.isArray(note)) {
        note.forEach((n) => this.pluck?.triggerAttack(n, time));
      } else {
        this.pluck.triggerAttack(note, time);
      }
    } catch (e) {
      console.error("PluckVoice trigger error:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.85): void {
    this.triggerAttackRelease(note, "8n", time, velocity);
  }

  public triggerRelease(_time?: number): void {
    // Pluck decays naturally
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.pluck || !patch.pluckParams) return;
    this.pluck.dampening = patch.pluckParams.dampening;
    this.pluck.resonance = patch.pluckParams.resonance;
    this.pluck.attackNoise = patch.pluckParams.attackNoise;
  }

  public dispose(): void {
    this.pluck?.dispose();
    this.outputNode?.dispose();
    this.pluck = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
