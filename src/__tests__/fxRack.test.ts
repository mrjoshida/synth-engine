import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js nodes for Node/Vitest headless testing
vi.mock("tone", () => {
  class MockNode {
    connectedTo: any = null;
    connect(target?: any) {
      this.connectedTo = target;
      return this;
    }
    toDestination() {
      this.connectedTo = "destination";
      return this;
    }
    dispose = vi.fn();
    start() { return this; }
    stop = vi.fn().mockReturnValue(this);
  }

  class MockGain extends MockNode {
    gain = { value: 1 };
    constructor(val = 1) {
      super();
      this.gain.value = val;
    }
  }

  class MockFreeverb extends MockNode {
    wet = { value: 0.15 };
    roomSize = { value: 0.75 };
    dampening = { value: 3500 };
    constructor(opts: any = {}) {
      super();
      if (opts.wet !== undefined) this.wet.value = opts.wet;
    }
  }

  class MockFeedbackDelay extends MockNode {
    wet = { value: 0.0 };
    delayTime = { value: "8n." };
    feedback = { value: 0.3 };
    constructor(opts: any = {}) {
      super();
      if (opts.wet !== undefined) this.wet.value = opts.wet;
      if (opts.delayTime !== undefined) this.delayTime.value = opts.delayTime;
      if (opts.feedback !== undefined) this.feedback.value = opts.feedback;
    }
  }

  class MockChorus extends MockNode {
    wet = { value: 0.0 };
    frequency = { value: 1.5 };
    depth = 0.6;
    delayTime = 3.5;
    constructor(opts: any = {}) {
      super();
      if (opts.wet !== undefined) this.wet.value = opts.wet;
      if (opts.frequency !== undefined) this.frequency.value = opts.frequency;
      if (opts.depth !== undefined) this.depth = opts.depth;
    }
  }

  class MockCompressor extends MockNode {
    threshold = { value: -6 };
    ratio = { value: 20 };
    knee = { value: 0 };
    attack = { value: 0.002 };
    release = { value: 0.12 };
    opts: any;
    constructor(opts: any = {}) {
      super();
      this.opts = opts;
      if (opts.threshold !== undefined) this.threshold.value = opts.threshold;
      if (opts.ratio !== undefined) this.ratio.value = opts.ratio;
      if (opts.knee !== undefined) this.knee.value = opts.knee;
      if (opts.attack !== undefined) this.attack.value = opts.attack;
      if (opts.release !== undefined) this.release.value = opts.release;
    }
  }

  class MockWaveShaper extends MockNode {
    curve: Float32Array | null = null;
    oversample = "none";
    constructor(curve?: any) {
      super();
      if (curve) this.curve = curve;
    }
  }

  class MockLimiter extends MockNode {
    constructor(public threshold = -1) {
      super();
    }
  }

  return {
    Gain: MockGain,
    Freeverb: MockFreeverb,
    FeedbackDelay: MockFeedbackDelay,
    Chorus: MockChorus,
    Compressor: MockCompressor,
    WaveShaper: MockWaveShaper,
    Limiter: MockLimiter,
    getDestination: () => new MockNode(),
    now: () => 0
  };
});

import { FxRack, softClipCurve } from "../effects/FxRack";

describe("FxRack Unit Tests", () => {
  let fxRack: FxRack;

  beforeEach(async () => {
    fxRack = new FxRack();
    await fxRack.init();
  });

  afterEach(() => {
    fxRack.dispose();
  });

  it("should initialize with clean baseline defaults (delay and chorus OFF by default)", () => {
    const config = fxRack.getConfig();
    expect(config.delayWet).toBe(0.0);
    expect(config.chorusWet).toBe(0.0);
    expect(config.reverbWet).toBe(0.15);
    expect(config.masterVolume).toBe(0.85);
  });

  it("should set delayWet to 0 and verify dry signal pass-through", () => {
    fxRack.setConfig({ delayWet: 0.0 });
    const config = fxRack.getConfig();
    expect(config.delayWet).toBe(0.0);
  });

  it("should dynamically set and read delay parameters", () => {
    fxRack.setConfig({
      delayWet: 0.65,
      delayFeedback: 0.45,
      delayTime: "4n"
    });
    const config = fxRack.getConfig();
    expect(config.delayWet).toBe(0.65);
    expect(config.delayFeedback).toBe(0.45);
    expect(config.delayTime).toBe("4n");
  });

  it("should dynamically set and read chorus parameters", () => {
    fxRack.setConfig({
      chorusWet: 0.5,
      chorusFrequency: 2.5,
      chorusDepth: 0.8
    });
    const config = fxRack.getConfig();
    expect(config.chorusWet).toBe(0.5);
    expect(config.chorusFrequency).toBe(2.5);
    expect(config.chorusDepth).toBe(0.8);
  });

  it("should dynamically set and read reverb parameters", () => {
    fxRack.setConfig({ reverbWet: 0.8 });
    const config = fxRack.getConfig();
    expect(config.reverbWet).toBe(0.8);
  });

  it("should set master volume correctly", () => {
    fxRack.setConfig({ masterVolume: 0.5 });
    const config = fxRack.getConfig();
    expect(config.masterVolume).toBe(0.5);
  });

  it("should clamp out-of-bounds volume and wet values between 0.0 and 1.0", () => {
    fxRack.setConfig({
      delayWet: 1.5,
      reverbWet: -0.5,
      masterVolume: 2.0
    });
    const config = fxRack.getConfig();
    expect(config.delayWet).toBe(1.0);
    expect(config.reverbWet).toBe(0.0);
    expect(config.masterVolume).toBe(1.0);
  });

  it("should dynamically calculate reverbDecay based on Freeverb roomSize", () => {
    const config = fxRack.getConfig();
    // Default roomSize is 0.75 in Freeverb mock, so 0.75 * 5 = 3.75
    expect(config.reverbDecay).toBeCloseTo(3.75);
  });

  it("should dynamically set and update reverbDecay via roomSize mapping", () => {
    fxRack.setConfig({ reverbDecay: 2.0 });
    const config = fxRack.getConfig();
    expect(config.reverbDecay).toBeCloseTo(2.0);
  });

  it("should support Tone.Reverb decay property when using Reverb instance", () => {
    const mockReverbInstance = {
      decay: 2.5,
      wet: { value: 0.2 },
      dispose: vi.fn(),
      connect: vi.fn().mockReturnThis()
    };
    (fxRack as any).reverb = mockReverbInstance;

    fxRack.setConfig({ reverbDecay: 4.2 });
    expect(mockReverbInstance.decay).toBe(4.2);
    expect(fxRack.getConfig().reverbDecay).toBe(4.2);
  });

  it("should dispose properly and clear nodes", () => {
    fxRack.dispose();
    const config = fxRack.getConfig();
    expect(config.delayWet).toBe(0);
    expect(config.chorusWet).toBe(0);
  });

  it("ramps numeric delayTime when smoothing and assigns tempo strings directly", () => {
    const delayTime = { value: "8n." as string | number, rampTo: vi.fn() };
    (fxRack as any).delay.delayTime = delayTime;

    fxRack.setConfig({ delayTime: 0.25 }, { smooth: true });
    expect(delayTime.rampTo).toHaveBeenCalledWith(0.25, 0.05);
    expect(delayTime.value).toBe("8n.");

    fxRack.setConfig({ delayTime: 0.5 });
    expect(delayTime.rampTo).toHaveBeenCalledTimes(1);
    expect(delayTime.value).toBe(0.5);

    fxRack.setConfig({ delayTime: "4n" }, { smooth: true });
    expect(delayTime.rampTo).toHaveBeenCalledTimes(1);
    expect(delayTime.value).toBe("4n");
  });
  it("should configure chain order correctly and configure compressor options", () => {
    const chorus = (fxRack as any).chorus;
    const delay = (fxRack as any).delay;
    const reverb = (fxRack as any).reverb;
    const masterGain = (fxRack as any).masterGain;
    const compressor = (fxRack as any).compressor;
    const clipGain = (fxRack as any).clipGain;
    const waveShaper = (fxRack as any).waveShaper;

    // Chain: chorus -> delay -> reverb -> masterGain -> compressor -> clipGain -> waveShaper -> destination
    expect(chorus.connectedTo).toBe(delay);
    expect(delay.connectedTo).toBe(reverb);
    expect(reverb.connectedTo).toBe(masterGain);
    expect(masterGain.connectedTo).toBe(compressor);
    expect(compressor.connectedTo).toBe(clipGain);
    expect(clipGain.connectedTo).toBe(waveShaper);
    expect(waveShaper.connectedTo).toBe("destination");

    // Compressor options: threshold -6, ratio 20, knee 0, attack 0.002, release 0.12
    expect(compressor.opts).toEqual({
      threshold: -6,
      ratio: 20,
      knee: 0,
      attack: 0.002,
      release: 0.12,
    });

    // WaveShaper and clipper gain: 1/CLIP_RANGE (0.25) and 4x oversampling
    expect(clipGain.gain.value).toBe(0.25);
    expect(waveShaper.oversample).toBe("4x");
    expect(waveShaper.curve).toBeInstanceOf(Float32Array);
    expect(waveShaper.curve.length).toBe(8192);
  });

  it("softClipCurve properties: identity below the knee, odd symmetry, monotonic, max |y| < 0.99, continuity at the knee", () => {
    const curve = softClipCurve(8192, 4, 0.9, 0.99);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(8192);

    const denom = curve.length - 1;
    let maxAbs = 0;

    for (let i = 0; i < curve.length; i++) {
      const u = -1 + (2 * i) / denom;
      const x = u * 4;
      const y = curve[i];
      const absY = Math.abs(y);
      if (absY > maxAbs) maxAbs = absY;

      // 1. Identity below knee (within 1e-6)
      if (Math.abs(x) <= 0.9) {
        expect(Math.abs(y - x)).toBeLessThan(1e-6);
      }

      // 2. Odd symmetry: f(-x) = -f(x) within 1e-6
      const oppositeY = curve[curve.length - 1 - i];
      expect(Math.abs(y + oppositeY)).toBeLessThan(1e-6);

      // 3. Monotonic: curve is non-decreasing
      if (i > 0) {
        expect(y).toBeGreaterThanOrEqual(curve[i - 1]);
      }
    }

    // 4. Max |y| < 0.99: bounded by single-precision float representation of ceiling
    expect(maxAbs).toBeLessThanOrEqual(Math.fround(0.99));
    expect(maxAbs).toBeLessThan(0.9901);

    // 5. Continuity (including at the knee): slope <= 1 everywhere, so no adjacent pair of
    // table entries may differ by more than one input step.
    const inputStep = (2 * 4) / denom;
    let maxStep = 0;
    for (let i = 1; i < curve.length; i++) {
      maxStep = Math.max(maxStep, Math.abs(curve[i] - curve[i - 1]));
    }
    expect(maxStep).toBeLessThanOrEqual(inputStep * (1 + 1e-3));
    // The saturating region really does bend: the last step is far smaller than the input step.
    expect(Math.abs(curve[curve.length - 1] - curve[curve.length - 2])).toBeLessThan(inputStep * 1e-3);
  });

  it("should dispose compressor, clipGain, and waveShaper on dispose", () => {
    const compressor = (fxRack as any).compressor;
    const clipGain = (fxRack as any).clipGain;
    const waveShaper = (fxRack as any).waveShaper;

    expect(compressor.dispose).not.toHaveBeenCalled();
    expect(clipGain.dispose).not.toHaveBeenCalled();
    expect(waveShaper.dispose).not.toHaveBeenCalled();

    fxRack.dispose();

    expect(compressor.dispose).toHaveBeenCalledTimes(1);
    expect(clipGain.dispose).toHaveBeenCalledTimes(1);
    expect(waveShaper.dispose).toHaveBeenCalledTimes(1);
    expect((fxRack as any).compressor).toBeNull();
    expect((fxRack as any).clipGain).toBeNull();
    expect((fxRack as any).waveShaper).toBeNull();
  });

  it("should route through clipper if compressor creation fails", async () => {
    const Tone = await import("tone");
    const origCompressor = Tone.Compressor;
    (Tone as any).Compressor = class FailingCompressor {
      constructor() {
        throw new Error("Compressor creation failed");
      }
    };

    try {
      const fallbackRack = new FxRack();
      await fallbackRack.init();

      const masterGain = (fallbackRack as any).masterGain;
      const clipGain = (fallbackRack as any).clipGain;
      const compressor = (fallbackRack as any).compressor;

      expect(compressor).toBeNull();
      expect(clipGain).not.toBeNull();
      // masterGain should connect directly to clipGain
      expect(masterGain.connectedTo).toBe(clipGain);

      fallbackRack.dispose();
    } finally {
      (Tone as any).Compressor = origCompressor;
    }
  });

  it("softClipCurve rejects parameters that violate its contract", () => {
    // ceiling <= knee, negative knee, non-positive or non-finite range, non-finite ceiling
    // (Infinity would otherwise produce Infinity * tanh(0) = NaN entries).
    const invalid: Array<[number, number, number]> = [
      [4, 0.9, 0.9],
      [4, 0.9, 0.5],
      [4, -0.1, 0.99],
      [0, 0.9, 0.99],
      [-4, 0.9, 0.99],
      [Number.NaN, 0.9, 0.99],
      [4, Number.NaN, 0.99],
      [4, 0.9, Number.POSITIVE_INFINITY],
    ];
    for (const [range, knee, ceiling] of invalid) {
      expect(() => softClipCurve(64, range, knee, ceiling)).toThrow(RangeError);
    }
    // The shipped parameters and a zero knee (pure saturation) remain valid.
    expect(softClipCurve(64, 4, 0.9, 0.99)).toHaveLength(64);
    const zeroKnee = softClipCurve(65, 4, 0, 0.99);
    expect(zeroKnee[32]).toBe(0);
    expect(zeroKnee.every((v) => Number.isFinite(v) && Math.abs(v) < 0.99)).toBe(true);
  });

  it("disposes a partially built clipper stage if init fails midway", async () => {
    const Tone = await import("tone");
    const origGain = Tone.Gain;
    const origWaveShaper = Tone.WaveShaper;
    const shapers: any[] = [];
    (Tone as any).WaveShaper = class RecordingWaveShaper extends (origWaveShaper as any) {
      constructor(curve?: any) {
        super(curve);
        shapers.push(this);
      }
    };
    // Only the clipper's input gain (1 / CLIP_RANGE) fails; the master gain still builds.
    (Tone as any).Gain = class FailingClipGain extends (origGain as any) {
      constructor(val?: number) {
        if (val === 0.25) throw new Error("clip gain creation failed");
        super(val);
      }
    };

    try {
      const rack = new FxRack();
      await rack.init();

      expect(shapers).toHaveLength(1);
      expect(shapers[0].connectedTo).toBe("destination");
      expect(shapers[0].dispose).toHaveBeenCalledTimes(1);
      expect((rack as any).waveShaper).toBeNull();
      expect((rack as any).clipGain).toBeNull();
      expect((rack as any).masterGain).not.toBeNull();

      rack.dispose();
    } finally {
      (Tone as any).Gain = origGain;
      (Tone as any).WaveShaper = origWaveShaper;
    }
  });

  it("disposes the compressor and bypasses it if connecting it fails", async () => {
    const Tone = await import("tone");
    const origCompressor = Tone.Compressor;
    const compressors: any[] = [];
    (Tone as any).Compressor = class UnconnectableCompressor extends (origCompressor as any) {
      constructor(opts?: any) {
        super(opts);
        compressors.push(this);
      }
      connect(): never {
        throw new Error("compressor connect failed");
      }
    };

    try {
      const rack = new FxRack();
      await rack.init();

      expect(compressors).toHaveLength(1);
      expect(compressors[0].dispose).toHaveBeenCalledTimes(1);
      expect((rack as any).compressor).toBeNull();
      expect((rack as any).clipGain).not.toBeNull();
      expect((rack as any).masterGain.connectedTo).toBe((rack as any).clipGain);

      rack.dispose();
    } finally {
      (Tone as any).Compressor = origCompressor;
    }
  });
});
