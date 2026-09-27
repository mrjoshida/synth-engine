/**
 * @file MembraneVoice implementation with PooledVoice.
 */

import * as Tone from "tone";
import { PooledVoice } from "./PooledVoice";
import { SynthPatch } from "../types";
import { getEffectiveParam } from "../params/patch";

export class MembraneVoice extends PooledVoice<Tone.MembraneSynth> {
  protected readonly engine = "membrane" as const;

  protected createSynth(): Tone.MembraneSynth {
    return new Tone.MembraneSynth();
  }

  protected buildChain(output: Tone.Gain): Tone.InputNode {
    return output;
  }

  protected releaseSeconds(_synth: Tone.MembraneSynth): number {
    const patch = this.currentPatch();
    return Number(getEffectiveParam(patch, "envelope.release"));
  }

  protected overrideRelease(synth: Tone.MembraneSynth, seconds: number): () => void {
    const prev = synth.envelope.release;
    synth.envelope.release = seconds;
    return () => {
      synth.envelope.release = prev;
    };
  }

  protected applySynth(synth: Tone.MembraneSynth, patch: SynthPatch, _smooth?: boolean): void {
    synth.pitchDecay = Number(getEffectiveParam(patch, "membraneParams.pitchDecay"));
    synth.octaves = Number(getEffectiveParam(patch, "membraneParams.octaves"));

    const attack = Number(getEffectiveParam(patch, "envelope.attack"));
    const decay = Number(getEffectiveParam(patch, "envelope.decay"));
    const sustain = Number(getEffectiveParam(patch, "envelope.sustain"));
    const release = Number(getEffectiveParam(patch, "envelope.release"));

    synth.envelope.set({ attack, decay, sustain, release });
  }

  public override triggerAttack(note: string | string[], time?: number, velocity: number = 0.9): void {
    this.triggerAttackRelease(note, "8n", time, velocity);
  }
}
