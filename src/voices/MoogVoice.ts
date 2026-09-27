/**
 * @file MoogVoice implementation with PooledVoice.
 */

import * as Tone from "tone";
import { PooledVoice } from "./PooledVoice";
import { SynthPatch } from "../types";
import { toToneOscillator, setToneParam } from "./helpers";
import { getEffectiveParam } from "../params/patch";

export class MoogVoice extends PooledVoice<Tone.MonoSynth> {
  protected readonly engine = "moog" as const;
  private saturation: Tone.Chebyshev | null = null;

  protected createSynth(): Tone.MonoSynth {
    return new Tone.MonoSynth({
      filter: {
        Q: 4.5,
        type: "lowpass",
        rolloff: -24,
      },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.25,
        sustain: 0.3,
        release: 0.8,
        baseFrequency: 180,
        octaves: 3.5,
        exponent: 2,
      },
    });
  }

  protected buildChain(output: Tone.Gain): Tone.InputNode {
    this.saturation = new Tone.Chebyshev(2);
    this.saturation.connect(output);
    return this.saturation;
  }

  protected releaseSeconds(_synth: Tone.MonoSynth): number {
    const patch = this.currentPatch();
    const envRel = Number(getEffectiveParam(patch, "envelope.release"));
    return Math.max(envRel, 0.8);
  }

  protected applySynth(synth: Tone.MonoSynth, patch: SynthPatch, smooth?: boolean): void {
    const oscConfig = toToneOscillator({
      type: getEffectiveParam(patch, "oscillator.type") as any,
      count: patch.oscillator?.count,
      spread: patch.oscillator?.spread,
    });
    (synth as any).set({ oscillator: oscConfig });

    const attack = Number(getEffectiveParam(patch, "envelope.attack"));
    const decay = Number(getEffectiveParam(patch, "envelope.decay"));
    const sustain = Number(getEffectiveParam(patch, "envelope.sustain"));
    const release = Number(getEffectiveParam(patch, "envelope.release"));
    (synth as any).set({ envelope: { attack, decay, sustain, release } });

    const freq = Number(getEffectiveParam(patch, "filter.frequency"));
    const q = Number(getEffectiveParam(patch, "filter.Q"));
    if (synth.filter) {
      setToneParam(synth.filter.frequency, freq, smooth);
      setToneParam(synth.filter.Q, q, smooth);
    }
  }

  protected override applyChain(patch: SynthPatch, _smooth?: boolean): void {
    const drive = Number(getEffectiveParam(patch, "moogParams.drive"));
    if (this.saturation && !Number.isNaN(drive)) {
      this.saturation.order = Math.max(1, Math.min(10, Math.round(drive * 5)));
    }
  }

  public override dispose(): void {
    super.dispose();
    this.saturation?.dispose();
    this.saturation = null;
  }
}
