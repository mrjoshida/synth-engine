import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js for comprehensive engine and patch loading testing
vi.mock("tone", () => {
  class MockNode {
    connect() { return this; }
    toDestination() { return this; }
    dispose() {}
    start() { return this; }
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

  it("should reset baseline FX sends and NOT leak delay between patches", () => {
    // 1. Find a preset with heavy delay (e.g. moog-starlight-lead)
    const starlightLead = BUILTIN_SYNTH_PRESETS.find(p => p.id === "moog-starlight-lead");
    expect(starlightLead).toBeDefined();
    expect(starlightLead?.fxSends?.delayWet).toBe(0.35);

    // 2. Load the lead patch and verify delay turns on
    engine.loadPatch(starlightLead!);
    expect(engine.fxRack.getConfig().delayWet).toBe(0.35);

    // 3. Find a patch with NO delay (e.g. moog-model-24)
    const subPatch = BUILTIN_SYNTH_PRESETS.find(p => p.id === "moog-model-24");
    expect(subPatch).toBeDefined();
    expect(subPatch?.fxSends?.delayWet).toBeUndefined();

    // 4. Load the dry sub patch and verify delay resets back to 0.0 without state leakage
    engine.loadPatch(subPatch!);
    expect(engine.fxRack.getConfig().delayWet).toBe(0.0);
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
});
