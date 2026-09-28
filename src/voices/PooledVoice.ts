/**
 * @file Abstract base class for pooled polyphonic synth voices using VoiceAllocator.
 */

import * as Tone from "tone";
import { BaseVoice, ApplyPatchOptions, HARD_STOP_RELEASE_S } from "./Voice";
import { SynthEngineType, SynthPatch } from "../types";
import { VoiceAllocator } from "./VoiceAllocator";
import { INIT_PATCH, withEngineType } from "../params/patch";

export const MAX_POOLED_VOICES = 12;

export abstract class PooledVoice<
  TSynth extends {
    connect: (dest: Tone.InputNode) => any;
    dispose: () => void;
    triggerAttack?: (note: string, time?: number, velocity?: number) => void;
    triggerRelease?: (time?: number) => void;
    triggerAttackRelease?: (note: string, duration: any, time?: number, velocity?: number) => void;
  }
> extends BaseVoice {
  protected synths: TSynth[] = [];
  protected busGain: Tone.Gain | null = null;
  protected allocator = new VoiceAllocator(MAX_POOLED_VOICES);
  protected tarCounter = 0;

  protected abstract createSynth(): TSynth;
  protected abstract buildChain(output: Tone.Gain): Tone.InputNode;
  protected abstract applySynth(synth: TSynth, patch: SynthPatch, smooth?: boolean): void;
  protected abstract releaseSeconds(synth: TSynth): number;
  protected abstract overrideRelease(synth: TSynth, seconds: number): () => void;
  protected applyChain?(_patch: SynthPatch, _smooth?: boolean): void;

  protected prewarmCount(): number {
    return 1;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.outputNode = new Tone.Gain(1.0);
    this.applyLevel(this.currentPatch(), { smooth: false });
    const destination = this.buildChain(this.outputNode);

    this.busGain = new Tone.Gain(1.0);
    this.busGain.connect(destination);

    for (const s of this.synths) {
      s.connect(this.busGain);
    }

    const prewarm = Math.min(this.prewarmCount(), MAX_POOLED_VOICES);
    for (let i = 0; i < prewarm; i++) {
      this.getOrCreateSynth(i);
    }

    this.applyChain?.(this.currentPatch(), false);

    this.isInitialized = true;
  }

  protected getOrCreateSynth(index: number): TSynth {
    while (this.synths.length <= index) {
      const s = this.createSynth();
      if (this.busGain) {
        s.connect(this.busGain);
      }
      this.applySynth(s, this.currentPatch(), false);
      this.synths.push(s);
    }
    return this.synths[index];
  }

  public override startNote(key: string, note: string, velocity: number = 0.8, time?: number): void {
    const now = time ?? Tone.now();
    const alloc = this.allocator.noteOn(key, now);
    const synth = this.getOrCreateSynth(alloc.index);
    try {
      synth.triggerAttack?.(note, time, velocity);
    } catch (e) {
      console.error(`${this.engine} startNote error:`, e);
    }
  }

  public override hardStop(time?: number): void {
    const now = time ?? Tone.now();
    for (let i = 0; i < this.synths.length; i++) {
      const synth = this.synths[i];
      let restore: (() => void) | null = null;
      try {
        restore = this.overrideRelease(synth, HARD_STOP_RELEASE_S);
      } catch (e) {
        console.error(`${this.engine} overrideRelease error:`, e);
      }
      try {
        synth.triggerRelease?.(now);
      } catch (e) {
        console.error(`${this.engine} hardStop synth error:`, e);
      } finally {
        try {
          restore?.();
        } catch (e) {
          console.error(`${this.engine} restoreRelease error:`, e);
        }
      }
    }
    this.allocator.releaseAll(now, HARD_STOP_RELEASE_S);
    this.clearKeyMap();
  }

  public override stopNote(key: string, time?: number): void {
    const now = time ?? Tone.now();
    const idx = this.allocator.indexOf(key);
    if (idx !== -1 && idx < this.synths.length) {
      const synth = this.synths[idx];
      const relSec = this.releaseSeconds(synth);
      const releasedIdx = this.allocator.noteOff(key, now, relSec);
      if (releasedIdx !== -1) {
        try {
          synth.triggerRelease?.(time);
        } catch (e) {
          console.error(`${this.engine} stopNote synth triggerRelease error:`, e);
        }
      }
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity: number = 0.8): void {
    const notes = Array.isArray(note) ? note : [note];
    for (const n of notes) {
      this.startNote(`note:${n}`, n, velocity, time);
    }
  }

  public triggerRelease(note?: string | string[], time?: number): void {
    const now = time ?? Tone.now();
    if (note !== undefined) {
      const notes = Array.isArray(note) ? note : [note];
      for (const n of notes) {
        this.stopNote(`note:${n}`, time);
      }
    } else {
      for (let i = 0; i < this.synths.length; i++) {
        try {
          this.synths[i].triggerRelease?.(time);
        } catch (e) {
          console.error(`${this.engine} triggerRelease synth error:`, e);
        }
      }
      const defaultRel = this.synths.length > 0 ? this.releaseSeconds(this.synths[0]) : 1;
      this.allocator.releaseAll(now, defaultRel);
    }
  }

  public triggerAttackRelease(
    note: string | string[],
    duration: string | number,
    time?: number,
    velocity: number = 0.8
  ): void {
    let durSec: number;
    try {
      durSec = typeof duration === "number" ? duration : Tone.Time(duration).toSeconds();
      if (!Number.isFinite(durSec) || durSec < 0) {
        console.warn(`${this.engine} triggerAttackRelease invalid duration:`, duration);
        return;
      }
    } catch (e) {
      console.warn(`${this.engine} triggerAttackRelease invalid duration:`, duration, e);
      return;
    }

    const notes = Array.isArray(note) ? note : [note];
    const now = time ?? Tone.now();

    for (const n of notes) {
      const key = `tar:${++this.tarCounter}`;
      const alloc = this.allocator.noteOn(key, now);
      const synth = this.getOrCreateSynth(alloc.index);
      try {
        if (typeof synth.triggerAttackRelease === "function") {
          synth.triggerAttackRelease(n, duration, time, velocity);
        } else {
          synth.triggerAttack?.(n, time, velocity);
        }
      } catch (e) {
        console.error(`${this.engine} triggerAttackRelease error:`, e);
      }
      const relSec = this.releaseSeconds(synth);
      this.allocator.noteOff(key, now, durSec + relSec);
    }
  }

  public applyPatch(patch: SynthPatch, opts?: ApplyPatchOptions): void {
    this.applyLevel(patch, opts);
    const smooth = opts?.smooth ?? false;
    for (const s of this.synths) {
      this.applySynth(s, patch, smooth);
    }
    if (this.applyChain) {
      this.applyChain(patch, smooth);
    }
  }

  public dispose(): void {
    for (const s of this.synths) {
      s.dispose();
    }
    this.synths = [];
    this.busGain?.dispose();
    this.outputNode?.dispose();
    this.busGain = null;
    this.outputNode = null;
    this.allocator = new VoiceAllocator(MAX_POOLED_VOICES);
    this.lastPatch = null;
    this.clearKeyMap();
    this.isInitialized = false;
  }
}
