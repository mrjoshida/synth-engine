import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch } from "../types";

export class DroneVoice extends BaseVoice {
  private droneSynth: Tone.Synth | null = null;
  private lfoFilter: Tone.AutoFilter | null = null;
  private isActive = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);

    this.lfoFilter = new Tone.AutoFilter({
      frequency: 0.15,
      depth: 0.65,
      baseFrequency: 120,
      octaves: 3.2,
      type: "sine"
    }).start();

    this.droneSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 1.8,
        decay: 1.2,
        sustain: 0.85,
        release: 3.5
      }
    });

    this.droneSynth.chain(this.lfoFilter, this.outputNode);
    this.isInitialized = true;
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity: number = 0.75): void {
    if (!this.droneSynth) return;
    const singleNote = Array.isArray(note) ? note[0] : note;
    this.droneSynth.triggerAttackRelease(singleNote, duration, time, velocity);
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.75): void {
    if (!this.droneSynth) return;
    const singleNote = Array.isArray(note) ? note[0] : note;
    this.droneSynth.triggerAttack(singleNote, time, velocity);
    this.isActive = true;
  }

  public triggerRelease(_note?: string | string[], time?: number): void {
    if (!this.droneSynth || !this.isActive) return;
    this.droneSynth.triggerRelease(time);
    this.isActive = false;
  }

  public toggle(note: string = "C2"): boolean {
    if (this.isActive) {
      this.triggerRelease();
    } else {
      this.triggerAttack(note);
    }
    return this.isActive;
  }

  public applyPatch(patch: SynthPatch): void {
    if (!this.droneSynth) return;

    if (patch.oscillator) {
      (this.droneSynth as any).set({ oscillator: { type: patch.oscillator.type } });
    }

    if (patch.envelope) {
      (this.droneSynth as any).set({ envelope: patch.envelope });
    }
  }

  public dispose(): void {
    this.droneSynth?.dispose();
    this.lfoFilter?.dispose();
    this.outputNode?.dispose();
    this.droneSynth = null;
    this.lfoFilter = null;
    this.outputNode = null;
    this.isInitialized = false;
  }
}
