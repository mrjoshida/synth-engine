import { describe, it, expect, vi, beforeEach } from "vitest";

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let workletsDeferred: Deferred<void> = createDeferred<void>();

vi.mock("tone", () => {
  class MockNode {
    connectedTo: unknown = null;
    connect(dest: unknown) {
      this.connectedTo = dest;
      return this;
    }
    disconnect = vi.fn();
    toDestination() {
      return this;
    }
    dispose = vi.fn();
    start() {
      return this;
    }
    stop() {
      return this;
    }
    chain() {
      return this;
    }
    set = vi.fn();
  }

  class MockParam {
    value: number;
    rampTo = vi.fn((val: number) => {
      this.value = val;
    });
    constructor(val = 1) {
      this.value = val;
    }
  }

  class MockGain extends MockNode {
    gain: MockParam;
    constructor(val = 1) {
      super();
      this.gain = new MockParam(val);
    }
  }

  class MockFilter extends MockNode {
    frequency = new MockParam(4500);
    Q = new MockParam(1.5);
    type = "lowpass";
    rolloff = -24;
    constructor(opts: { frequency?: number; Q?: number; type?: string; rolloff?: number } = {}) {
      super();
      if (opts.frequency !== undefined) this.frequency.value = opts.frequency;
      if (opts.Q !== undefined) this.Q.value = opts.Q;
      if (opts.type !== undefined) this.type = opts.type;
      if (opts.rolloff !== undefined) this.rolloff = opts.rolloff;
    }
  }

  class MockPluckSynth extends MockNode {
    triggerAttack = vi.fn();
    release = 1;
    dampening = 4000;
    resonance = 0.7;
    attackNoise = 1;
  }

  class MockMonoSynth extends MockNode {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    set = vi.fn();
    envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1.4, set: vi.fn() };
    filterEnvelope = { release: 1.4 };
    filter = {
      frequency: new MockParam(500),
      Q: new MockParam(4.5),
      type: "lowpass",
      rolloff: -24,
    };
  }

  class MockChebyshev extends MockNode {
    order = 2;
    constructor(order = 2) {
      super();
      this.order = order;
    }
  }

  return {
    Gain: MockGain,
    Filter: MockFilter,
    PluckSynth: MockPluckSynth,
    MonoSynth: MockMonoSynth,
    Chebyshev: MockChebyshev,
    getDestination: () => new MockNode(),
    now: () => 0,
    getContext: () => ({
      workletsAreReady: () => workletsDeferred.promise,
    }),
  };
});

import { PluckVoice } from "../voices/PluckVoice";
import { MoogVoice } from "../voices/MoogVoice";
import { MAX_POOLED_VOICES } from "../voices/PooledVoice";

/** The pool's synths (Tone mocks) of a pooled voice. */
function pooledSynths(voice: object): unknown[] {
  return (voice as unknown as { synths: unknown[] }).synths;
}

describe("PluckVoice readiness and pool pre-warming", () => {
  beforeEach(() => {
    workletsDeferred = createDeferred<void>();
  });

  it("creates the full pool of synths after init", async () => {
    const pluck = new PluckVoice();
    workletsDeferred.resolve();
    await pluck.init();

    const synths = (pluck as unknown as { synths: unknown[] }).synths;
    expect(synths.length).toBe(MAX_POOLED_VOICES);
    pluck.dispose();
  });

  it("does not resolve init until the worklet promise resolves", async () => {
    const pluck = new PluckVoice();
    let resolved = false;

    const initPromise = pluck.init().then(() => {
      resolved = true;
    });

    // Let everything except the worklet promise settle: several macrotask turns, not just microtasks.
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    expect(pooledSynths(pluck).length).toBe(MAX_POOLED_VOICES);
    expect(resolved).toBe(false);

    workletsDeferred.resolve();
    await initPromise;
    expect(resolved).toBe(true);

    pluck.dispose();
  });

  it("resolves, does not reject, and logs a warning when the worklet promise rejects", async () => {
    const pluck = new PluckVoice();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    workletsDeferred.reject(new Error("AudioWorklet initialization failure"));
    await expect(pluck.init()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PluckVoice"),
      expect.objectContaining({ message: "AudioWorklet initialization failure" })
    );
    expect(pooledSynths(pluck).length).toBe(MAX_POOLED_VOICES);
    warnSpy.mockRestore();
    pluck.dispose();
  });

  it("resolves after the timeout when the worklet promise never settles", async () => {
    vi.useFakeTimers();
    try {
      const pluck = new PluckVoice();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      let resolved = false;
      const initPromise = pluck.init().then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(4999);
      expect(resolved).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await initPromise;

      expect(resolved).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("PluckVoice"),
        expect.objectContaining({ message: expect.stringContaining("timed out") })
      );

      warnSpy.mockRestore();
      pluck.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("non-pluck pooled voice (MoogVoice) still pre-creates exactly 1 synth", async () => {
    const moog = new MoogVoice();
    await moog.init();

    const synths = (moog as unknown as { synths: unknown[] }).synths;
    expect(synths.length).toBe(1);
    moog.dispose();
  });

  it("returns without re-waiting or re-creating synths when init is called twice", async () => {
    const pluck = new PluckVoice();
    workletsDeferred.resolve();
    const first = pluck.init();
    await first;

    const synthsBefore = [...pooledSynths(pluck)];
    expect(synthsBefore.length).toBe(MAX_POOLED_VOICES);

    const second = pluck.init();
    expect(second).toBe(first);
    await second;
    expect(pooledSynths(pluck).length).toBe(MAX_POOLED_VOICES);
    expect(pooledSynths(pluck).every((s, i) => s === synthsBefore[i])).toBe(true);
    pluck.dispose();
  });

  it("builds a fresh pool when initialized again after dispose", async () => {
    const pluck = new PluckVoice();
    workletsDeferred.resolve();
    await pluck.init();
    const firstSynth = pooledSynths(pluck)[0];

    pluck.dispose();
    expect(pooledSynths(pluck).length).toBe(0);

    await pluck.init();
    expect(pooledSynths(pluck).length).toBe(MAX_POOLED_VOICES);
    expect(pooledSynths(pluck)[0]).not.toBe(firstSynth);
    pluck.dispose();
  });
});
