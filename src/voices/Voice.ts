import * as Tone from "tone";
import { SynthPatch } from "../types";

export abstract class BaseVoice {
  protected outputNode: Tone.Gain | null = null;
  protected isInitialized = false;

  public connect(destination: Tone.InputNode): this {
    if (this.outputNode) {
      this.outputNode.connect(destination);
    }
    return this;
  }

  public disconnect(): this {
    this.outputNode?.disconnect();
    return this;
  }

  public abstract init(): Promise<void>;
  public abstract triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity?: number): void;
  public abstract triggerAttack(note: string | string[], time?: number, velocity?: number): void;
  public abstract triggerRelease(note?: string | string[], time?: number): void;
  public abstract applyPatch(patch: SynthPatch): void;
  public abstract dispose(): void;

  public getOutput(): Tone.Gain | null {
    return this.outputNode;
  }
}
