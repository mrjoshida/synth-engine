/**
 * @file PluckVoice implementation with PooledVoice.
 */

import * as Tone from "tone";
import { PooledVoice } from "./PooledVoice";
import { SynthPatch } from "../types";
import { getEffectiveParam } from "../params/patch";

export class PluckVoice extends PooledVoice<Tone.PluckSynth> {
  protected readonly engine = "pluck" as const;

  protected createSynth(): Tone.PluckSynth {
    return new Tone.PluckSynth();
  }

  protected buildChain(output: Tone.Gain): Tone.InputNode {
    return output;
  }

  protected releaseSeconds(synth: Tone.PluckSynth): number {
    const rel = Number(synth.release);
    return Number.isFinite(rel) ? rel : 1;
  }

  protected applySynth(synth: Tone.PluckSynth, patch: SynthPatch, _smooth?: boolean): void {
    synth.dampening = Number(getEffectiveParam(patch, "pluckParams.dampening"));
    synth.resonance = Number(getEffectiveParam(patch, "pluckParams.resonance"));
    synth.attackNoise = Number(getEffectiveParam(patch, "pluckParams.attackNoise"));
  }

  public override triggerAttack(note: string | string[], time?: number, velocity: number = 0.85): void {
    this.triggerAttackRelease(note, "8n", time, velocity);
  }
}
