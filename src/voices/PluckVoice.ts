/**
 * @file PluckVoice implementation with PooledVoice.
 */

import * as Tone from "tone";
import { PooledVoice, MAX_POOLED_VOICES } from "./PooledVoice";
import { SynthPatch } from "../types";
import { getEffectiveParam } from "../params/patch";

/** Upper bound on how long init waits for Tone's AudioWorklet module (the pluck comb filter). */
const WORKLET_TIMEOUT_MS = 5000;

/** Tone's (protected) `Context.workletsAreReady()`, or undefined when the runtime has no context API. */
function workletsReady(): Promise<void> | undefined {
  if (!("getContext" in Tone)) return undefined;
  const ctx = Tone.getContext() as unknown as { workletsAreReady?: () => Promise<void> };
  return ctx.workletsAreReady?.();
}

/**
 * Tone.PluckSynth's comb filter is an AudioWorklet node that Tone creates asynchronously, once the
 * worklet module has loaded; a note played before then is silent. So this voice creates its whole
 * pool up front (no synth is created at note time) and init waits, bounded, for the module.
 */
export class PluckVoice extends PooledVoice<Tone.PluckSynth> {
  protected readonly engine = "pluck" as const;
  private initPromise: Promise<void> | null = null;

  protected override prewarmCount(): number {
    return MAX_POOLED_VOICES;
  }

  public override init(): Promise<void> {
    this.initPromise ??= this.initAndAwaitWorklets();
    return this.initPromise;
  }

  private async initAndAwaitWorklets(): Promise<void> {
    await super.init();
    const ready = workletsReady();
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${WORKLET_TIMEOUT_MS} ms`)),
            WORKLET_TIMEOUT_MS
          );
        }),
      ]);
      // Let Tone's own readiness callbacks, which create the worklet nodes, run before we resolve.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    } catch (err: unknown) {
      console.warn("PluckVoice: AudioWorklet not ready; pluck notes may be silent until it loads.", err);
    } finally {
      clearTimeout(timer);
    }
  }

  public override dispose(): void {
    super.dispose();
    this.initPromise = null;
  }

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

  protected overrideRelease(synth: Tone.PluckSynth, seconds: number): () => void {
    const prev = synth.release;
    synth.release = seconds;
    return () => {
      synth.release = prev;
    };
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
