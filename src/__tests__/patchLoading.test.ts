import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js for comprehensive engine and patch loading testing
vi.mock("tone", () => {
  class MockNode {
    connect() { return this; }
    toDestination() { return this; }
    dispose() {}
    start() { return this; }
    stop() { return this; }
    chain() { return this; }
    set = vi.fn();
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
    }
  }

  class MockLimiter extends MockNode {}

  class MockSynthVoice extends MockNode {
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
    volume = { value: 0 };
    releaseAll = vi.fn();
    envelope = { set: vi.fn() };
    filter = { set: vi.fn() };
    oscillator = { set: vi.fn() };
    pitchDecay = 0.05;
    octaves = 8;
  }

  class MockSampler extends MockSynthVoice {
    loaded = true;
    constructor(opts: any = {}) {
      super();
      if (opts.onload) setTimeout(opts.onload, 0);
    }
  }

  class MockChebyshev extends MockNode {
    order = 1;
  }

  class MockFilter extends MockNode {
    frequency = { value: 4500 };
    Q = { value: 1 };
    type = "lowpass";
  }

  class MockLFO extends MockNode {
    frequency = { value: 1 };
    min = 0;
    max = 1;
    amplitude = { value: 1 };
  }

  class MockAutoFilter extends MockNode {
    frequency = { value: 0.15 };
    depth = { value: 0.65 };
    baseFrequency = 60;
    octaves = 2.5;
    wet = { value: 1 };
  }

  return {
    Gain: MockGain,
    Freeverb: MockFreeverb,
    FeedbackDelay: MockFeedbackDelay,
    Chorus: MockChorus,
    Limiter: MockLimiter,
    PolySynth: MockSynthVoice,
    Synth: MockSynthVoice,
    FMSynth: MockSynthVoice,
    PluckSynth: MockSynthVoice,
    MonoSynth: MockSynthVoice,
    MembraneSynth: MockSynthVoice,
    Sampler: MockSampler,
    Chebyshev: MockChebyshev,
    Filter: MockFilter,
    LFO: MockLFO,
    AutoFilter: MockAutoFilter,
    Time: vi.fn((_t) => ({ toSeconds: () => 0.5 })),
    getDestination: () => new MockNode(),
    now: () => 0,
    start: vi.fn().mockResolvedValue(undefined),
    Transport: {
      state: "stopped",
      bpm: { value: 120 },
      swing: 0,
      swingSubdivision: "8n",
      start: vi.fn(),
      stop: vi.fn()
    }
  };
});

import { SynthEngine } from "../engine/SynthEngine";
import { BUILTIN_SYNTH_PRESETS } from "../presets/builtinPresets";

describe("Patch Loading & State Isolation Unit Tests", () => {
  let engine: SynthEngine;

  beforeEach(async () => {
    engine = new SynthEngine();
    await engine.init();
  });

  afterEach(() => {
    engine.dispose();
  });

  it("should reset baseline FX sends and NOT leak delay or chorus parameters between patches", () => {
    // 1. Manually configure custom FX parameters or load a custom patch
    engine.fxRack.setConfig({
      delayWet: 0.5,
      delayTime: "4n",
      delayFeedback: 0.8,
      chorusWet: 0.6,
      chorusFrequency: 4.0,
      chorusDepth: 0.9,
      reverbWet: 0.8,
      reverbDecay: 1.0,
      masterVolume: 0.5
    });

    const beforePatch = engine.fxRack.getConfig();
    expect(beforePatch.delayTime).toBe("4n");
    expect(beforePatch.delayFeedback).toBe(0.8);
    expect(beforePatch.chorusFrequency).toBe(4.0);
    expect(beforePatch.reverbDecay).toBeCloseTo(1.0);

    // 2. Load a patch with no FX sends specified
    const dryPatch = {
      id: "test-dry-patch",
      name: "Test Dry Patch",
      engineType: "poly" as const
    };

    // 3. Verify all FX parameters are cleanly reset back to baseline defaults
    engine.loadPatch(dryPatch);
    const afterPatch = engine.fxRack.getConfig();
    expect(afterPatch.delayWet).toBe(0.0);
    expect(afterPatch.delayTime).toBe("8n.");
    expect(afterPatch.delayFeedback).toBe(0.3);
    expect(afterPatch.chorusWet).toBe(0.0);
    expect(afterPatch.chorusFrequency).toBe(1.5);
    expect(afterPatch.chorusDepth).toBe(0.6);
    expect(afterPatch.reverbWet).toBe(0.15);
    expect(afterPatch.reverbDecay).toBeCloseTo(3.75);
    expect(afterPatch.masterVolume).toBe(0.85);
  });

  it("should load all 22 built-in presets sequentially without error", () => {
    expect(BUILTIN_SYNTH_PRESETS.length).toBe(22);
    BUILTIN_SYNTH_PRESETS.forEach(patch => {
      expect(() => engine.loadPatch(patch)).not.toThrow();
      const voice = engine.getVoice(patch.engineType);
      expect(voice).toBeDefined();
    });
  });

  it("should successfully trigger notes on all engine types after patch loading", () => {
    const voiceTypes = ["poly", "fm", "pluck", "moog", "drone", "membrane", "sampler"] as const;
    voiceTypes.forEach(vType => {
      expect(() => engine.playNote("C4", "8n", 0.8, vType)).not.toThrow();
      expect(() => engine.playChord(["C4", "E4", "G4"], "4n", 0.8, vType)).not.toThrow();
    });
  });

  it("should release specific notes on polyphonic voices when note is passed, and releaseAll when omitted", () => {
    const polyVoice = engine.polyVoice;
    const polySynth = (polyVoice as any).polySynth;
    
    polyVoice.triggerRelease("E4");
    expect(polySynth.triggerRelease).toHaveBeenCalledWith("E4", undefined);

    polyVoice.triggerRelease();
    expect(polySynth.releaseAll).toHaveBeenCalled();

    const fmVoice = engine.fmVoice;
    const fmPoly = (fmVoice as any).fmPoly;

    fmVoice.triggerRelease("G4");
    expect(fmPoly.triggerRelease).toHaveBeenCalledWith("G4", undefined);

    fmVoice.triggerRelease();
    expect(fmPoly.releaseAll).toHaveBeenCalled();
  });
});
