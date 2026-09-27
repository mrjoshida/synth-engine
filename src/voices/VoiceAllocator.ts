/**
 * @file Dynamic voice allocator implementing LRU and voice-stealing policies.
 */

export interface AllocationResult {
  /** Allocated voice slot index (0 .. maxVoices - 1). */
  index: number;
  /** Key of previously assigned note that was stolen, or null if no active note stolen. */
  stolenKey: string | null;
  /** True if the note key was already active in a slot and retriggered. */
  retrigger: boolean;
}

interface VoiceSlot {
  key: string | null;
  held: boolean;
  startTime: number;
  freeAt: number;
}

/**
 * Manages allocation of a fixed number of polyphonic voice slots.
 */
export class VoiceAllocator {
  private readonly maxVoices: number;
  private readonly slots: VoiceSlot[] = [];

  constructor(maxVoices: number) {
    if (!Number.isInteger(maxVoices) || maxVoices < 1) {
      throw new RangeError(`maxVoices must be an integer >= 1, received: ${maxVoices}`);
    }
    this.maxVoices = maxVoices;
  }

  /**
   * Number of voice slots instantiated so far (<= maxVoices).
   */
  get size(): number {
    return this.slots.length;
  }

  /**
   * Allocates a voice slot for a given note key at time `now`.
   * Allocation policy, first match wins:
   * 1. key already owns a slot (held or ringing): reuse it (retrigger: true).
   * 2. a free slot exists (released and freeAt <= now): take the least recently used one (tie: lowest index).
   * 3. size < maxVoices: create slot index = size.
   * 4. a ringing slot exists: steal the one with the smallest freeAt (stolenKey = its key).
   * 5. steal the held slot with the oldest start time.
   * @param key Unique key for the note event.
   * @param now Current timestamp in seconds.
   */
  noteOn(key: string, now: number): AllocationResult {
    // 1. key already owns a slot (held or ringing): reuse it (retrigger: true)
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.key === key) {
        slot.held = true;
        slot.startTime = now;
        slot.freeAt = Infinity;
        return { index: i, stolenKey: null, retrigger: true };
      }
    }

    // 2. a free slot exists (released and freeAt <= now): take the least recently used one (tie: lowest index)
    let bestFreeIndex = -1;
    let oldestStartTime = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.held && slot.freeAt <= now) {
        if (slot.startTime < oldestStartTime) {
          oldestStartTime = slot.startTime;
          bestFreeIndex = i;
        }
      }
    }
    if (bestFreeIndex !== -1) {
      const slot = this.slots[bestFreeIndex];
      slot.key = key;
      slot.held = true;
      slot.startTime = now;
      slot.freeAt = Infinity;
      return { index: bestFreeIndex, stolenKey: null, retrigger: false };
    }

    // 3. size < maxVoices: create slot index = size
    if (this.slots.length < this.maxVoices) {
      const newIndex = this.slots.length;
      this.slots.push({
        key,
        held: true,
        startTime: now,
        freeAt: Infinity,
      });
      return { index: newIndex, stolenKey: null, retrigger: false };
    }

    // 4. a ringing slot exists: steal the one with the smallest freeAt (stolenKey = its key)
    let bestRingingIndex = -1;
    let smallestFreeAt = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.held && slot.freeAt > now) {
        if (slot.freeAt < smallestFreeAt) {
          smallestFreeAt = slot.freeAt;
          bestRingingIndex = i;
        }
      }
    }
    if (bestRingingIndex !== -1) {
      const slot = this.slots[bestRingingIndex];
      const stolenKey = slot.key;
      slot.key = key;
      slot.held = true;
      slot.startTime = now;
      slot.freeAt = Infinity;
      return { index: bestRingingIndex, stolenKey, retrigger: false };
    }

    // 5. steal the held slot with the oldest start time
    let bestHeldIndex = -1;
    let oldestHeldStartTime = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.held) {
        if (slot.startTime < oldestHeldStartTime) {
          oldestHeldStartTime = slot.startTime;
          bestHeldIndex = i;
        }
      }
    }
    if (bestHeldIndex !== -1) {
      const slot = this.slots[bestHeldIndex];
      const stolenKey = slot.key;
      slot.key = key;
      slot.held = true;
      slot.startTime = now;
      slot.freeAt = Infinity;
      return { index: bestHeldIndex, stolenKey, retrigger: false };
    }

    // Fallback: should not be reached with maxVoices >= 1
    return { index: 0, stolenKey: null, retrigger: false };
  }

  /**
   * Releases a held note key.
   * Marks the slot released, becoming free at `now + max(0, releaseSeconds)`.
   * Returns slot index, or -1 if the key was not found or was not held.
   * @param key Note key.
   * @param now Current timestamp in seconds.
   * @param releaseSeconds Envelope release duration in seconds.
   */
  noteOff(key: string, now: number, releaseSeconds: number): number {
    const safeRelease = Number.isFinite(releaseSeconds) ? Math.max(0, releaseSeconds) : 0;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.key === key && slot.held) {
        slot.held = false;
        slot.freeAt = now + safeRelease;
        return i;
      }
    }
    return -1;
  }

  /**
   * Releases all currently held slots.
   * Returns an array of slot indices that were held and are now released.
   * @param now Current timestamp in seconds.
   * @param releaseSeconds Envelope release duration in seconds.
   */
  releaseAll(now: number, releaseSeconds: number): number[] {
    const releasedIndices: number[] = [];
    const safeRelease = Number.isFinite(releaseSeconds) ? Math.max(0, releaseSeconds) : 0;
    const freeAt = now + safeRelease;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.held) {
        slot.held = false;
        slot.freeAt = freeAt;
        releasedIndices.push(i);
      }
    }
    return releasedIndices;
  }

  /**
   * Returns the slot index assigned to the key (held or ringing), or -1 if unassigned.
   * @param key Note key.
   */
  indexOf(key: string): number {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].key === key) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Returns a list of all currently held note keys.
   */
  heldKeys(): string[] {
    const keys: string[] = [];
    for (const slot of this.slots) {
      if (slot.held && slot.key !== null) {
        keys.push(slot.key);
      }
    }
    return keys;
  }
}
