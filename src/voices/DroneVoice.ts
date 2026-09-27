/**
 * @file DroneVoice implementation with PooledVoice.
 */

import * as Tone from "tone";
import { PooledVoice } from "./PooledVoice";
import { SynthPatch } from "../types";
import { toToneOscillator } from "./helpers";
import { getEffectiveParam } from "../params/patch";

export class DroneVoice extends PooledVoice<Tone.Synth> {
  protected readonly engine = "drone" as const;
  private lfoFilter: Tone.AutoFilter | null = null;
  private isToggled = false;

  protected createSynth(): Tone.Synth {
    return new Tone.Synth();
  }

  protected buildChain(output: Tone.Gain): Tone.InputNode {
    this.lfoFilter = new Tone.AutoFilter({
      frequency: 0.15,
      depth: 0.65,
      baseFrequency: 120,
      octaves: 3.2,
      type: "sine",
    }).start();
    this.lfoFilter.connect(output);
    return this.lfoFilter;
  }

  protected releaseSeconds(_synth: Tone.Synth): number {
    const patch = this.currentPatch();
    return Number(getEffectiveParam(patch, "envelope.release"));
  }

  protected overrideRelease(synth: Tone.Synth, seconds: number): () => void {
    const prev = synth.envelope.release;
    synth.envelope.release = seconds;
    return () => {
      synth.envelope.release = prev;
    };
  }

  protected applySynth(synth: Tone.Synth, patch: SynthPatch, _smooth?: boolean): void {
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
  }

  public override triggerRelease(note?: string | string[], time?: number): void {
    super.triggerRelease(note, time);
    if (note === undefined) {
      this.isToggled = false;
    }
  }

  public override hardStop(time?: number): void {
    super.hardStop(time);
    this.isToggled = false;
  }

  public toggle(note: string = "C2"): boolean {
    if (this.isToggled) {
      this.stopNote("drone:toggle");
      this.isToggled = false;
      return false;
    } else {
      this.startNote("drone:toggle", note);
      this.isToggled = true;
      return true;
    }
  }

  public override dispose(): void {
    super.dispose();
    this.lfoFilter?.dispose();
    this.lfoFilter = null;
    this.isToggled = false;
  }
}
