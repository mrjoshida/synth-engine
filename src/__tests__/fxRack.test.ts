import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js nodes for Node/Vitest headless testing
vi.mock("tone", () => {
  class MockNode {
    connect() { return this; }
    toDestination() { return this; }
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
    Limiter: MockLimiter,
    getDestination: () => new MockNode(),
    now: () => 0
  };
});

import { FxRack } from "../effects/FxRack";

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
});
