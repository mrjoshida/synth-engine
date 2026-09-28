import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js for voice level testing
vi.mock("tone", () => {
  class MockNode {
    connectedTo: any = null;
    connect(dest: any) {
      this.connectedTo = dest;
      return this;
    }
    disconnect = vi.fn();
    toDestination() { return this; }
    dispose = vi.fn();
    start() { return this; }
    stop() { return this; }
    chain() { return this; }
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
    constructor(opts: any = {}) {
      super();
      if (opts.frequency !== undefined) this.frequency.value = opts.frequency;
      if (opts.Q !== undefined) this.Q.value = opts.Q;
      if (opts.type !== undefined) this.type = opts.type;
      if (opts.rolloff !== undefined) this.rolloff = opts.rolloff;
    }
  }

  class MockPolySynth extends MockNode {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    set = vi.fn();
    get = vi.fn().mockReturnValue({ envelope: { release: 1.4 } });
  }

  class MockMonoSynth extends MockNode {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    set = vi.fn();
    envelope = { release: 1.4, set: vi.fn() };
    filterEnvelope = { release: 1.4 };
  }

  class MockPluckSynth extends MockNode {
    triggerAttack = vi.fn();
    release = 1;
    dampening = 4000;
    resonance = 0.7;
    attackNoise = 1;
  }

  class MockMembraneSynth extends MockNode {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    set = vi.fn();
    envelope = { release: 1.4, set: vi.fn() };
    pitchDecay = 0.05;
    octaves = 8;
  }

  class MockSynth extends MockNode {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    set = vi.fn();
    envelope = { release: 1.4, set: vi.fn() };
  }

  class MockSampler extends MockNode {
    releaseAll = vi.fn();
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    loaded = true;
  }

  class MockAutoFilter extends MockNode {
    frequency = { value: 0.15 };
    depth = { value: 0.65 };
    baseFrequency = 60;
    octaves = 2.5;
    wet = { value: 1 };
  }

  class MockChebyshev extends MockNode {
    order = 2;
    constructor(order = 2) {
      super();
      this.order = order;
    }
  }
  class MockFMSynth extends MockNode {}
  class MockCompressor extends MockNode {}
  class MockWaveShaper extends MockNode {}

  return {
    Gain: MockGain,
    Filter: MockFilter,
    PolySynth: MockPolySynth,
    MonoSynth: MockMonoSynth,
    PluckSynth: MockPluckSynth,
    MembraneSynth: MockMembraneSynth,
    Synth: MockSynth,
    Sampler: MockSampler,
    AutoFilter: MockAutoFilter,
    Chebyshev: MockChebyshev,
    FMSynth: MockFMSynth,
    Compressor: MockCompressor,
    WaveShaper: MockWaveShaper,
    getDestination: () => new MockNode(),
    now: () => 0,
  };
});

import { PolyVoice } from "../voices/PolyVoice";
import { MoogVoice } from "../voices/MoogVoice";
import { PluckVoice } from "../voices/PluckVoice";
import { FMVoice } from "../voices/FMVoice";
import { DroneVoice } from "../voices/DroneVoice";
import { MembraneVoice } from "../voices/MembraneVoice";
import { SamplerVoice } from "../voices/SamplerVoice";
import { ENGINE_TRIM_DB, dbToGain } from "../voices/Voice";
import { INIT_PATCH, getPatchParam, setPatchParam } from "../params/patch";
import { getParamSpec, PARAM_SPECS } from "../params/specs";
import { sanitizePatch } from "../params/sanitize";
import { SynthPatch } from "../types";
import { BUILTIN_SYNTH_PRESETS } from "../presets/builtinPresets";

// Snapshot of the shipped trims. The unit tests below zero the (mutable) table and
// restore this snapshot afterwards so no other test observes modified trims.
const SHIPPED_TRIMS = { ...ENGINE_TRIM_DB };

describe("Task B: Per-patch voice level & engine trim", () => {
  beforeEach(() => {
    for (const k of Object.keys(ENGINE_TRIM_DB) as (keyof typeof ENGINE_TRIM_DB)[]) {
      ENGINE_TRIM_DB[k] = 0;
    }
  });

  afterEach(() => {
    for (const k of Object.keys(ENGINE_TRIM_DB) as (keyof typeof ENGINE_TRIM_DB)[]) {
      ENGINE_TRIM_DB[k] = SHIPPED_TRIMS[k];
    }
  });

  it("PARAM_SPECS contains level in output group with correct bounds", () => {
    const spec = getParamSpec("level");
    expect(spec).toBeDefined();
    expect(spec!.label).toBe("Level");
    expect(spec!.group).toBe("output");
    expect(spec!.kind).toBe("number");
    expect(spec!.unit).toBe("dB");
    expect(spec!.min).toBe(-24);
    expect(spec!.max).toBe(12);
    expect(spec!.step).toBe(0.5);
    expect(spec!.default).toBe(0);
    expect(spec!.scale).toBe("linear");
  });

  it("dbToGain converts dB correctly", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 4);
    expect(dbToGain(6)).toBeCloseTo(1.99526, 4);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 4);
  });

  it("applyPatch with level -6 sets outputNode gain to about 0.501 for poly voice", async () => {
    const poly = new PolyVoice();
    await poly.init();

    const patch: SynthPatch = {
      ...INIT_PATCH,
      engineType: "poly",
      level: -6,
    };
    poly.applyPatch(patch);

    const gain = poly.getOutput()!.gain.value;
    expect(gain).toBeCloseTo(0.501, 3);
    poly.dispose();
  });

  it("applyPatch with level -6 sets outputNode gain to about 0.501 for pooled voice (moog and pluck)", async () => {
    const moog = new MoogVoice();
    await moog.init();

    const moogPatch: SynthPatch = {
      ...INIT_PATCH,
      engineType: "moog",
      level: -6,
    };
    moog.applyPatch(moogPatch);

    expect(moog.getOutput()!.gain.value).toBeCloseTo(0.501, 3);
    moog.dispose();

    const pluck = new PluckVoice();
    await pluck.init();

    const pluckPatch: SynthPatch = {
      ...INIT_PATCH,
      engineType: "pluck",
      level: -6,
    };
    pluck.applyPatch(pluckPatch);

    expect(pluck.getOutput()!.gain.value).toBeCloseTo(0.501, 3);
    pluck.dispose();
  });

  it("default level of 0 gives gain 1", async () => {
    const poly = new PolyVoice();
    await poly.init();

    // Default patch without level (effective level 0)
    poly.applyPatch({ ...INIT_PATCH, engineType: "poly" });
    expect(poly.getOutput()!.gain.value).toBeCloseTo(1.0, 4);

    // Explicit level: 0
    poly.applyPatch({ ...INIT_PATCH, engineType: "poly", level: 0 });
    expect(poly.getOutput()!.gain.value).toBeCloseTo(1.0, 4);

    poly.dispose();
  });

  it("the trim is added: ENGINE_TRIM_DB + level", async () => {
    const poly = new PolyVoice();
    await poly.init();

    ENGINE_TRIM_DB.poly = 3;
    // With trim = 3 and level = -6, total = -3 dB -> gain ~ 0.7079
    poly.applyPatch({ ...INIT_PATCH, engineType: "poly", level: -6 });
    expect(poly.getOutput()!.gain.value).toBeCloseTo(0.7079, 3);

    // With trim = -2 and level = 0, total = -2 dB -> gain ~ 0.7943
    ENGINE_TRIM_DB.poly = -2;
    poly.applyPatch({ ...INIT_PATCH, engineType: "poly", level: 0 });
    expect(poly.getOutput()!.gain.value).toBeCloseTo(0.7943, 3);

    poly.dispose();
  });

  it("smooth uses the ramp path (rampTo)", async () => {
    const poly = new PolyVoice();
    await poly.init();

    const rampSpy = poly.getOutput()!.gain.rampTo as any;
    rampSpy.mockClear();

    poly.applyPatch({ ...INIT_PATCH, engineType: "poly", level: -6 }, { smooth: true });
    expect(rampSpy).toHaveBeenCalledWith(expect.closeTo(0.501, 3), 0.05);

    poly.dispose();
  });

  it("applies level when patch is loaded before init", async () => {
    const poly = new PolyVoice();
    poly.applyPatch({ ...INIT_PATCH, engineType: "poly", level: -6 });
    await poly.init();
    expect(poly.getOutput()!.gain.value).toBeCloseTo(0.501, 3);
    poly.dispose();

    const moog = new MoogVoice();
    moog.applyPatch({ ...INIT_PATCH, engineType: "moog", level: -6 });
    await moog.init();
    expect(moog.getOutput()!.gain.value).toBeCloseTo(0.501, 3);
    moog.dispose();
  });

  it("applies default level at init without prior applyPatch", async () => {
    const poly = new PolyVoice();
    await poly.init();
    expect(poly.getOutput()!.gain.value).toBeCloseTo(1.0, 4);
    poly.dispose();

    const moog = new MoogVoice();
    await moog.init();
    expect(moog.getOutput()!.gain.value).toBeCloseTo(1.0, 4);
    moog.dispose();
  });

  it("applies level correctly across all 7 voices", async () => {
    const voices = [
      new PolyVoice(),
      new FMVoice(),
      new PluckVoice(),
      new MoogVoice(),
      new DroneVoice(),
      new MembraneVoice(),
      new SamplerVoice(),
    ];

    for (const v of voices) {
      await v.init();
      v.applyPatch({ ...INIT_PATCH, engineType: (v as any).engine, level: -6 });
      expect(v.getOutput()!.gain.value).toBeCloseTo(0.501, 3);
      v.dispose();
    }
  });

  it("handles patch parameter get/set and sanitization for level", () => {
    const patch = { ...INIT_PATCH, level: -6 };
    expect(getPatchParam(patch, "level")).toBe(-6);

    const updated = setPatchParam(patch, "level", 3.5);
    expect(updated).not.toBeNull();
    expect(updated!.level).toBe(3.5);

    // Clamping: max 12
    const clampedMax = setPatchParam(patch, "level", 20);
    expect(clampedMax!.level).toBe(12);

    // Clamping: min -24
    const clampedMin = setPatchParam(patch, "level", -30);
    expect(clampedMin!.level).toBe(-24);

    // Sanitization
    const sanitized = sanitizePatch({
      ...INIT_PATCH,
      level: -12,
    });
    expect(sanitized).not.toBeNull();
    expect(sanitized!.level).toBe(-12);

    // Sanitization with invalid value falls back to default 0
    const sanitizedInvalid = sanitizePatch({
      ...INIT_PATCH,
      level: "invalid",
    });
    expect(sanitizedInvalid).not.toBeNull();
    expect(sanitizedInvalid!.level).toBe(0);
  });
});

describe("Shipped loudness calibration", () => {
  it("every non-sampler built-in preset declares a level inside the Level spec range", () => {
    const spec = getParamSpec("level")!;
    const calibrated = BUILTIN_SYNTH_PRESETS.filter((p) => p.engineType !== "sampler");
    expect(calibrated.length).toBe(19);
    for (const p of calibrated) {
      expect(typeof p.level, p.id).toBe("number");
      expect(p.level!, p.id).toBeGreaterThanOrEqual(spec.min as number);
      expect(p.level!, p.id).toBeLessThanOrEqual(spec.max as number);
      expect(sanitizePatch(p)!.level, p.id).toBe(p.level);
    }
  });

  it("engine trims are finite, within 24 dB, and leave the sampler untouched", () => {
    // Outside the unit-test hooks the live table must hold the shipped values.
    expect({ ...ENGINE_TRIM_DB }).toEqual(SHIPPED_TRIMS);
    for (const [engine, trim] of Object.entries(ENGINE_TRIM_DB)) {
      expect(Number.isFinite(trim), engine).toBe(true);
      expect(Math.abs(trim), engine).toBeLessThanOrEqual(24);
    }
    expect(ENGINE_TRIM_DB.sampler).toBe(0);
    expect(ENGINE_TRIM_DB.moog).toBeLessThan(0);
  });
});
