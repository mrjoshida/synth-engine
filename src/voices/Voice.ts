/**
 * @file Base voice abstract class and keyed live-note API.
 */

import * as Tone from "tone";
import { SynthPatch } from "../types";

/**
 * Envelope release duration (in seconds) used during emergency hard stops.
 * Short enough to silence voices within ~10 ms without generating audible DC offset clicks.
 */
export const HARD_STOP_RELEASE_S = 0.01;

export interface ApplyPatchOptions {
  /** If true, parameter transitions use rampTo(v, 0.05). */
  smooth?: boolean;
}

export abstract class BaseVoice {
  protected outputNode: Tone.Gain | null = null;
  protected isInitialized = false;

  /**
   * Tracks active keyed notes: key -> note pitch.
   */
  protected keyToNoteMap: Map<string, string> = new Map();

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
  public abstract triggerAttackRelease(
    note: string | string[],
    duration: string | number,
    time?: number,
    velocity?: number
  ): void;
  public abstract triggerAttack(note: string | string[], time?: number, velocity?: number): void;
  public abstract triggerRelease(note?: string | string[], time?: number): void;
  public abstract applyPatch(patch: SynthPatch, opts?: ApplyPatchOptions): void;
  public abstract dispose(): void;

  public getOutput(): Tone.Gain | null {
    return this.outputNode;
  }

  /**
   * Starts a note keyed by a unique identifier.
   * If the key already has an active note, releases it first.
   * @param key Unique key for the note event.
   * @param note Pitch name (e.g. "C4").
   * @param velocity Note velocity 0..1.
   * @param time Scheduled start time in seconds.
   */
  public startNote(key: string, note: string, velocity: number = 0.8, time?: number): void {
    const prevNote = this.keyToNoteMap.get(key);
    if (prevNote !== undefined) {
      this.triggerRelease(prevNote, time);
    }
    this.keyToNoteMap.set(key, note);
    this.triggerAttack(note, time, velocity);
  }

  /**
   * Stops a note keyed by a unique identifier.
   * No-op if key is not active.
   * @param key Unique key for the note event.
   * @param time Scheduled stop time in seconds.
   */
  public stopNote(key: string, time?: number): void {
    const note = this.keyToNoteMap.get(key);
    if (note !== undefined) {
      this.triggerRelease(note, time);
      this.keyToNoteMap.delete(key);
    }
  }

  /**
   * Clears all key mappings.
   */
  public clearKeyMap(): void {
    this.keyToNoteMap.clear();
  }

  /**
   * Hard stop: immediately silences active notes and clears the key map.
   * Default implementation releases everything and clears the key map.
   * Overrides shorten release to 0.01s before releasing and restoring.
   */
  public hardStop(time?: number): void {
    this.triggerRelease(undefined, time);
    this.clearKeyMap();
  }
}
