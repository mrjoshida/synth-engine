import { describe, it, expect } from "vitest";
import { BUILTIN_SYNTH_PRESETS } from "../presets/builtinPresets";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";
import {
  PARAM_SPECS,
  getParamSpec,
  getParamSpecs,
  getDefaultParam,
  clampParam,
  ParamSpec,
} from "../params/specs";
import {
  PATCH_SCHEMA_VERSION,
  FX_BASELINE,
  INIT_PATCH,
  clonePatch,
  createSection,
  getPatchParam,
  getEffectiveParam,
  setPatchParam,
  withEngineType,
} from "../params/patch";
import { sanitizePatch } from "../params/sanitize";
import { VoiceAllocator } from "../voices/VoiceAllocator";
import { SynthEngineType, SynthPatch } from "../types";

describe("Part 1: specs module", () => {
  it("should have unique paths for all PARAM_SPECS", () => {
    const paths = PARAM_SPECS.map((s) => s.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("should enforce min < max, log scale min > 0, and non-empty choices", () => {
    for (const s of PARAM_SPECS) {
      if (s.kind === "number") {
        expect(s.min).toBeDefined();
        expect(s.max).toBeDefined();
        expect(s.min!).toBeLessThan(s.max!);
        if (s.scale === "log") {
          expect(s.min!).toBeGreaterThan(0);
        }
      } else if (s.kind === "choice") {
        expect(s.choices).toBeDefined();
        expect(s.choices!.length).toBeGreaterThan(0);
        expect(s.choices!).toContain(s.default);
      }
    }
  });

  it("should satisfy clampParam(s, s.default) === s.default for all specs", () => {
    for (const s of PARAM_SPECS) {
      expect(clampParam(s, s.default)).toBe(s.default);
    }
  });

  it("should ensure every spec has a non-empty engines list", () => {
    for (const s of PARAM_SPECS) {
      expect(s.engines.length).toBeGreaterThan(0);
    }
  });

  it("should return correct specs for getParamSpecs(pluck)", () => {
    const pluckSpecs = getParamSpecs("pluck");
    const pluckPaths = pluckSpecs.map((s) => s.path);
    expect(pluckPaths.some((p) => p.startsWith("pluckParams."))).toBe(true);
    expect(pluckPaths.some((p) => p.startsWith("fxSends."))).toBe(true);
    expect(pluckPaths.some((p) => p.startsWith("envelope."))).toBe(false);
  });

  it("should have FX spec defaults matching FX_BASELINE", () => {
    for (const key of Object.keys(FX_BASELINE) as (keyof typeof FX_BASELINE)[]) {
      const spec = getParamSpec(`fxSends.${key}`);
      expect(spec).toBeDefined();
      expect(spec!.default).toBe(FX_BASELINE[key]);
    }
  });

  it("should handle clampParam edge cases for number and choice", () => {
    const numSpec = getParamSpec("filter.frequency")!;
    expect(clampParam(numSpec, 10)).toBe(20);
    expect(clampParam(numSpec, 25000)).toBe(20000);
    expect(clampParam(numSpec, 1000)).toBe(1000);
    expect(clampParam(numSpec, NaN)).toBeUndefined();
    expect(clampParam(numSpec, Infinity)).toBeUndefined();
    expect(clampParam(numSpec, "1000")).toBeUndefined();
    expect(clampParam(numSpec, null)).toBeUndefined();

    const intStepSpec = getParamSpec("oscillator.count")!;
    expect(clampParam(intStepSpec, 2.7)).toBe(3);
    expect(clampParam(intStepSpec, 2.2)).toBe(2);

    const choiceSpec = getParamSpec("filter.type")!;
    expect(clampParam(choiceSpec, "lowpass")).toBe("lowpass");
    expect(clampParam(choiceSpec, "invalid-type")).toBeUndefined();
    expect(clampParam(choiceSpec, 123)).toBeUndefined();

    // Unknown kind fallback
    const fakeSpec = { ...numSpec, kind: "unknown" as any };
    expect(clampParam(fakeSpec, 100)).toBeUndefined();
  });

  it("should return undefined for getParamSpec with unknown path", () => {
    expect(getParamSpec("unknown.path")).toBeUndefined();
  });

  it("should be deeply frozen", () => {
    expect(Object.isFrozen(PARAM_SPECS)).toBe(true);
    expect(Object.isFrozen(PARAM_SPECS[0])).toBe(true);
  });

  it("should return engine defaults or spec default via getDefaultParam", () => {
    // Engine override
    expect(getDefaultParam("filter.Q", "moog")).toBe(4.5);
    expect(getDefaultParam("envelope.attack", "moog")).toBe(0.015);
    expect(getDefaultParam("filter.frequency", "fm")).toBe(8000);
    // Fallback to spec default
    expect(getDefaultParam("filter.Q", "poly")).toBe(1.5);
    expect(getDefaultParam("filter.frequency", "poly")).toBe(4500);
    // Unknown path
    expect(getDefaultParam("unknown.path", "moog")).toBeUndefined();
  });
});

describe("Part 1: patch module", () => {
  it("should have valid INIT_PATCH and FX_BASELINE constants", () => {
    expect(PATCH_SCHEMA_VERSION).toBe(1);
    expect(INIT_PATCH.schemaVersion).toBe(1);
    expect(INIT_PATCH.id).toBe("init");
    expect(INIT_PATCH.name).toBe("Init");
    expect(INIT_PATCH.category).toBe("keys");
    expect(INIT_PATCH.engineType).toBe("poly");
    expect(Object.isFrozen(INIT_PATCH)).toBe(true);
    expect(Object.isFrozen(FX_BASELINE)).toBe(true);
  });

  it("should clonePatch properly without mutating or sharing references", () => {
    const copy = clonePatch(INIT_PATCH as SynthPatch);
    expect(copy).toEqual(INIT_PATCH);
    copy.name = "Modified";
    expect(INIT_PATCH.name).toBe("Init");
  });

  it("should getPatchParam and getEffectiveParam accurately", () => {
    const patch = clonePatch(INIT_PATCH as SynthPatch);
    expect(getPatchParam(patch, "filter.frequency")).toBe(4500);
    expect(getPatchParam(patch, "unknown.path")).toBeUndefined();
    expect(getPatchParam(patch, "filter")).toBeUndefined(); // non-primitive returns undefined

    // prototype / constructor walk test
    expect(getPatchParam(patch, "constructor.name")).toBeUndefined();

    // getEffectiveParam
    expect(getEffectiveParam(patch, "filter.frequency")).toBe(4500);
    expect(getEffectiveParam(patch, "unknown.path")).toBeUndefined();

    // moog patch without filter.Q returns moog default 4.5
    const moogNoQ: SynthPatch = {
      ...clonePatch(INIT_PATCH as SynthPatch),
      engineType: "moog",
      filter: {
        frequency: 850,
        type: "lowpass",
      },
    };
    expect(getEffectiveParam(moogNoQ, "filter.Q")).toBe(4.5);

    // missing fxSends key falls back to FX_BASELINE
    const patchNoFx: SynthPatch = {
      ...clonePatch(INIT_PATCH as SynthPatch),
      fxSends: {},
    };
    expect(getEffectiveParam(patchNoFx, "fxSends.reverbWet")).toBe(0.15);
    expect(getEffectiveParam(patchNoFx, "fxSends.reverbDecay")).toBe(3.75);

    // missing non-fx field falls back to spec/engine default
    const patchNoFilter: SynthPatch = {
      ...clonePatch(INIT_PATCH as SynthPatch),
      filter: undefined,
    };
    expect(getEffectiveParam(patchNoFilter, "filter.frequency")).toBe(4500);
  });

  it("should setPatchParam and not mutate input (including deep-frozen input)", () => {
    const updated = setPatchParam(INIT_PATCH as SynthPatch, "filter.frequency", 1200);
    expect(updated).not.toBeNull();
    expect(updated!.filter?.frequency).toBe(1200);
    expect(INIT_PATCH.filter?.frequency).toBe(4500);
    expect(updated!.schemaVersion).toBe(1);

    // Invalid path -> null
    expect(setPatchParam(INIT_PATCH as SynthPatch, "invalid.path", 100)).toBeNull();

    // Invalid value -> null
    expect(setPatchParam(INIT_PATCH as SynthPatch, "filter.type", "invalid-filter")).toBeNull();

    // engineType delegation
    const engineSwitched = setPatchParam(INIT_PATCH as SynthPatch, "engineType", "fm");
    expect(engineSwitched).not.toBeNull();
    expect(engineSwitched!.engineType).toBe("fm");
    expect(engineSwitched!.fmParams).toBeDefined();
    expect(engineSwitched!.fmParams?.harmonicity).toBe(3.5);
  });

  it("should createSection leave optional fields absent and fill required fields", () => {
    const osc = createSection("oscillator", "poly");
    expect(osc.type).toBe("sawtooth");
    expect(osc.count).toBeUndefined();
    expect(osc.spread).toBeUndefined();

    const filt = createSection("filter", "moog");
    expect(filt.frequency).toBe(4500);
    expect(filt.type).toBe("lowpass");
    expect(filt.Q).toBeUndefined();
    expect(filt.rolloff).toBeUndefined();

    const fx = createSection("fxSends", "poly");
    expect(fx).toEqual({});
  });

  it("should create missing parent sections with spec defaults when setPatchParam is called", () => {
    const minimal: SynthPatch = {
      schemaVersion: 1,
      id: "min",
      name: "Min",
      category: "lead",
      engineType: "moog",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
    };

    const withOsc = setPatchParam(minimal, "oscillator.spread", 30);
    expect(withOsc!.oscillator?.type).toBe("sawtooth");
    expect(withOsc!.oscillator?.spread).toBe(30);

    const withFilter = setPatchParam(minimal, "filter.Q", 5);
    expect(withFilter!.filter?.frequency).toBe(4500);
    expect(withFilter!.filter?.type).toBe("lowpass");
    expect(withFilter!.filter?.Q).toBe(5);

    const withFm = setPatchParam(minimal, "fmParams.harmonicity", 4);
    expect(withFm!.fmParams?.harmonicity).toBe(4);
    expect(withFm!.fmParams?.modulationIndex).toBe(10);
    expect(withFm!.fmParams?.modulationEnvelope.attack).toBe(0.5);

    const withPluck = setPatchParam(minimal, "pluckParams.resonance", 0.8);
    expect(withPluck!.pluckParams?.dampening).toBe(4000);
    expect(withPluck!.pluckParams?.resonance).toBe(0.8);

    const withMoog = setPatchParam(minimal, "moogParams.drive", 0.9);
    expect(withMoog!.moogParams?.subOscLevel).toBe(0);
    expect(withMoog!.moogParams?.ladderCutoff).toBe(20000);
    expect(withMoog!.moogParams?.drive).toBe(0.9);

    const withMembrane = setPatchParam(minimal, "membraneParams.octaves", 6);
    expect(withMembrane!.membraneParams?.pitchDecay).toBe(0.05);
    expect(withMembrane!.membraneParams?.octaves).toBe(6);

    const withFx = setPatchParam(minimal, "fxSends.reverbWet", 0.5);
    expect(withFx!.fxSends?.reverbWet).toBe(0.5);

    const withSampler = setPatchParam(minimal, "samplerConfig.instrumentId", "celesta");
    expect(withSampler!.samplerConfig?.instrumentId).toBe("celesta");

    const withEnv = setPatchParam({ ...minimal, envelope: undefined as any }, "envelope.attack", 0.5);
    expect(withEnv!.envelope.attack).toBe(0.5);
    expect(withEnv!.envelope.decay).toBe(0.35); // moog default
  });

  it("should withEngineType preserve existing sections and add engine-specific defaults", () => {
    const base = clonePatch(INIT_PATCH as SynthPatch);
    base.oscillator = { type: "square" };

    const fmPatch = withEngineType(base, "fm");
    expect(fmPatch.engineType).toBe("fm");
    expect(fmPatch.oscillator?.type).toBe("square");
    expect(fmPatch.fmParams?.harmonicity).toBe(3.5);

    const pluckPatch = withEngineType(base, "pluck");
    expect(pluckPatch.engineType).toBe("pluck");
    expect(pluckPatch.pluckParams?.dampening).toBe(4200);

    const moogPatch = withEngineType(base, "moog");
    expect(moogPatch.engineType).toBe("moog");
    expect(moogPatch.moogParams?.drive).toBe(0.4);
    expect(moogPatch.moogParams?.subOscLevel).toBe(0);

    const membranePatch = withEngineType(base, "membrane");
    expect(membranePatch.engineType).toBe("membrane");
    expect(membranePatch.membraneParams?.pitchDecay).toBe(0.05);

    const samplerPatch = withEngineType(base, "sampler");
    expect(samplerPatch.engineType).toBe("sampler");
    expect(samplerPatch.samplerConfig?.instrumentId).toBe("grand-piano");
  });
});

describe("Part 1: sanitize module", () => {
  it("should sanitize every BUILTIN_SYNTH_PRESET to equal itself with schemaVersion: 1", () => {
    for (const preset of BUILTIN_SYNTH_PRESETS) {
      const sanitized = sanitizePatch(preset);
      expect(sanitized).toEqual({
        ...preset,
        schemaVersion: 1,
      });
    }
  });

  it("should reject non-plain-object inputs with null", () => {
    expect(sanitizePatch(null)).toBeNull();
    expect(sanitizePatch(undefined)).toBeNull();
    expect(sanitizePatch([])).toBeNull();
    expect(sanitizePatch("string")).toBeNull();
    expect(sanitizePatch(123)).toBeNull();
    expect(sanitizePatch(true)).toBeNull();
  });

  it("should reject invalid engineType, missing or empty id/name", () => {
    const valid = clonePatch(INIT_PATCH as SynthPatch);

    expect(sanitizePatch({ ...valid, engineType: "invalid" })).toBeNull();
    expect(sanitizePatch({ ...valid, id: "" })).toBeNull();
    expect(sanitizePatch({ ...valid, id: "   " })).toBeNull();
    expect(sanitizePatch({ ...valid, name: "" })).toBeNull();
    expect(sanitizePatch({ ...valid, name: "   " })).toBeNull();
    expect(sanitizePatch({ ...valid, id: "a".repeat(101) })).toBeNull();
    expect(sanitizePatch({ ...valid, name: "a".repeat(101) })).toBeNull();
  });

  it("should validate schemaVersion: absent or 1 allowed, others rejected", () => {
    const valid = clonePatch(INIT_PATCH as SynthPatch);
    delete (valid as any).schemaVersion;
    expect(sanitizePatch(valid)?.schemaVersion).toBe(1);

    expect(sanitizePatch({ ...valid, schemaVersion: 1 })?.schemaVersion).toBe(1);
    expect(sanitizePatch({ ...valid, schemaVersion: 2 })).toBeNull();
    expect(sanitizePatch({ ...valid, schemaVersion: "1" })).toBeNull();
  });

  it("should fallback category to keys if invalid and truncate/check description", () => {
    const valid = clonePatch(INIT_PATCH as SynthPatch);
    const sanitizedCat = sanitizePatch({ ...valid, category: "invalid" as any });
    expect(sanitizedCat?.category).toBe("keys");

    const validDesc = sanitizePatch({ ...valid, description: "A valid description" });
    expect(validDesc?.description).toBe("A valid description");

    const tooLongDesc = sanitizePatch({ ...valid, description: "a".repeat(501) });
    expect(tooLongDesc?.description).toBeUndefined();

    const nonStringDesc = sanitizePatch({ ...valid, description: 123 as any });
    expect(nonStringDesc?.description).toBeUndefined();
  });

  it("should clamp out-of-range numeric fields and fallback invalid choices", () => {
    const input = {
      ...clonePatch(INIT_PATCH as SynthPatch),
      filter: {
        frequency: 1e6, // max 20000
        type: "invalidChoice",
        rolloff: -99,
        Q: 100, // max 20
      },
      envelope: {
        attack: -1, // min 0.001
        decay: "invalid", // fallback default 0.4
        sustain: NaN, // fallback default 0.3
        release: Infinity, // fallback default 1.4
      },
    };

    const sanitized = sanitizePatch(input);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.filter?.frequency).toBe(20000);
    expect(sanitized!.filter?.type).toBe("lowpass"); // spec default
    expect(sanitized!.filter?.rolloff).toBe(-24); // spec default
    expect(sanitized!.filter?.Q).toBe(20);
    expect(sanitized!.envelope.attack).toBe(0.001);
    expect(sanitized!.envelope.decay).toBe(0.4);
    expect(sanitized!.envelope.sustain).toBe(0.3);
    expect(sanitized!.envelope.release).toBe(1.4);
  });

    it("should never copy unknown keys and prevent prototype pollution using raw JSON string", () => {
    const jsonStr = "{\"id\":\"t\",\"name\":\"T\",\"engineType\":\"poly\",\"__proto__\":{\"polluted\":true},\"constructor\":{\"prototype\":{\"polluted\":true}},\"envelope\":{\"attack\":0.1,\"decay\":0.2,\"sustain\":0.5,\"release\":1,\"__proto__\":{\"polluted\":true}},\"fxSends\":{\"__proto__\":{\"polluted\":true},\"reverbWet\":0.2}}";
    const rawMalicious = JSON.parse(jsonStr);

    const result = sanitizePatch(rawMalicious);
    expect(result).not.toBeNull();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);

    const knownTopKeys = new Set(["schemaVersion", "id", "name", "category", "engineType", "envelope", "fxSends"]);
    for (const k of Object.keys(result!)) {
      expect(knownTopKeys.has(k)).toBe(true);
    }

    const knownEnvKeys = new Set(["attack", "decay", "sustain", "release"]);
    for (const k of Object.keys(result!.envelope)) {
      expect(knownEnvKeys.has(k)).toBe(true);
    }

    const knownFxKeys = new Set(["reverbWet"]);
    for (const k of Object.keys(result!.fxSends!)) {
      expect(knownFxKeys.has(k)).toBe(true);
    }

    expect(({} as any).polluted).toBeUndefined();
  });

  it("should accept deep-frozen input without mutating it", () => {
    const frozen = Object.freeze({
      id: "frozen-patch",
      name: "Frozen",
      category: "lead",
      engineType: "poly",
      envelope: Object.freeze({ attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.0 }),
    });

    const sanitized = sanitizePatch(frozen);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.id).toBe("frozen-patch");
  });

  it("should handle samplerConfig validation rules", () => {
    // Valid sampler engine with valid instrument
    const validSampler = {
      id: "piano",
      name: "Piano",
      engineType: "sampler",
      envelope: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.5 },
      samplerConfig: { instrumentId: "grand-piano" },
    };
    expect(sanitizePatch(validSampler)?.samplerConfig?.instrumentId).toBe("grand-piano");

    // Sampler engine with invalid instrumentId -> returns null
    const invalidSampler = {
      ...validSampler,
      samplerConfig: { instrumentId: "nonexistent-instrument" },
    };
    expect(sanitizePatch(invalidSampler)).toBeNull();

    // Sampler engine missing samplerConfig -> returns null
    const missingSamplerConfig = {
      id: "piano",
      name: "Piano",
      engineType: "sampler",
      envelope: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.5 },
    };
    expect(sanitizePatch(missingSamplerConfig)).toBeNull();

    // Non-sampler engine with invalid samplerConfig -> drops samplerConfig
    const nonSamplerWithInvalid = {
      ...clonePatch(INIT_PATCH as SynthPatch),
      samplerConfig: { instrumentId: "nonexistent-instrument" },
    };
    const sanitizedNonSampler = sanitizePatch(nonSamplerWithInvalid);
    expect(sanitizedNonSampler).not.toBeNull();
    expect(sanitizedNonSampler!.samplerConfig).toBeUndefined();
  });

  it("should handle moogParams non-spec and fxSends.drive passthrough and clamping", () => {
    const moogPatch = {
      id: "moog",
      name: "Moog",
      engineType: "moog",
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.0 },
      moogParams: {
        subOscLevel: 1.5, // clamps to 1
        ladderCutoff: 10, // clamps to 20
        ladderResonance: 25, // clamps to 20
        drive: 0.7,
      },
      fxSends: {
        drive: 1.2, // clamps to 1
        reverbWet: 0.2,
      },
    };

    const sanitized = sanitizePatch(moogPatch);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.moogParams?.subOscLevel).toBe(1);
    expect(sanitized!.moogParams?.ladderCutoff).toBe(20);
    expect(sanitized!.moogParams?.ladderResonance).toBe(20);
    expect(sanitized!.moogParams?.drive).toBe(0.7);
    expect(sanitized!.fxSends?.drive).toBe(1);

    // Invalid non-spec fields fallback to defaults
    const moogInvalid = {
      ...moogPatch,
      moogParams: {
        subOscLevel: "invalid",
        ladderCutoff: NaN,
        ladderResonance: Infinity,
        drive: 0.4,
      },
      fxSends: {
        drive: "invalid",
      },
    };
    const sanitizedInvalid = sanitizePatch(moogInvalid);
    expect(sanitizedInvalid!.moogParams?.subOscLevel).toBe(0);
    expect(sanitizedInvalid!.moogParams?.ladderCutoff).toBe(20000);
    expect(sanitizedInvalid!.moogParams?.ladderResonance).toBe(0);
    expect(sanitizedInvalid!.fxSends?.drive).toBeUndefined();
  });

  it("should handle optional sections: absent or non-object omitted", () => {
    const minimal = {
      id: "min",
      name: "Min",
      engineType: "poly",
      envelope: null, // becomes default
      oscillator: "not-an-object",
      filter: null,
      fmParams: 123,
      pluckParams: [],
      moogParams: null,
      membraneParams: undefined,
      fxSends: "string",
    };

    const sanitized = sanitizePatch(minimal);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.envelope.attack).toBe(0.08);
    expect(sanitized!.oscillator).toBeUndefined();
    expect(sanitized!.filter).toBeUndefined();
    expect(sanitized!.fmParams).toBeUndefined();
    expect(sanitized!.pluckParams).toBeUndefined();
    expect(sanitized!.moogParams).toBeUndefined();
    expect(sanitized!.membraneParams).toBeUndefined();
    expect(sanitized!.fxSends).toBeUndefined();
  });
});

describe("Part 1: VoiceAllocator", () => {
  it("should throw RangeError for invalid maxVoices", () => {
    expect(() => new VoiceAllocator(0)).toThrow(RangeError);
    expect(() => new VoiceAllocator(-1)).toThrow(RangeError);
    expect(() => new VoiceAllocator(2.5)).toThrow(RangeError);
    expect(() => new VoiceAllocator(NaN)).toThrow(RangeError);
  });

  it("should grow size up to maxVoices on noteOn", () => {
    const allocator = new VoiceAllocator(3);
    expect(allocator.size).toBe(0);

    const r0 = allocator.noteOn("C4", 0);
    expect(r0).toEqual({ index: 0, stolenKey: null, retrigger: false });
    expect(allocator.size).toBe(1);

    const r1 = allocator.noteOn("E4", 1);
    expect(r1).toEqual({ index: 1, stolenKey: null, retrigger: false });
    expect(allocator.size).toBe(2);

    const r2 = allocator.noteOn("G4", 2);
    expect(r2).toEqual({ index: 2, stolenKey: null, retrigger: false });
    expect(allocator.size).toBe(3);
  });

  it("policy 1: reuse slot if key already owns a slot (retrigger: true)", () => {
    const allocator = new VoiceAllocator(3);
    allocator.noteOn("C4", 0);
    allocator.noteOn("E4", 1);

    // Retrigger held key
    const ret1 = allocator.noteOn("C4", 2);
    expect(ret1).toEqual({ index: 0, stolenKey: null, retrigger: true });

    // Release E4 so it is ringing
    allocator.noteOff("E4", 3, 2); // ringing until 5
    expect(allocator.indexOf("E4")).toBe(1);

    // Retrigger ringing key
    const ret2 = allocator.noteOn("E4", 4);
    expect(ret2).toEqual({ index: 1, stolenKey: null, retrigger: true });
    expect(allocator.heldKeys()).toContain("E4");
  });

  it("policy 2: reuse free slot (freeAt <= now) by LRU (oldest startTime), tie lowest index", () => {
    const allocator = new VoiceAllocator(3);
    allocator.noteOn("C4", 0); // slot 0, start 0
    allocator.noteOn("E4", 1); // slot 1, start 1
    allocator.noteOn("G4", 2); // slot 2, start 2

    // Release slot 1 and slot 0
    allocator.noteOff("E4", 3, 0); // slot 1 freeAt 3
    allocator.noteOff("C4", 3, 0); // slot 0 freeAt 3

    // At now = 4, both slot 0 and slot 1 are free.
    // slot 0 startTime was 0; slot 1 startTime was 1. Oldest start time is slot 0.
    const res = allocator.noteOn("B4", 4);
    expect(res).toEqual({ index: 0, stolenKey: null, retrigger: false });

    // Now slot 1 is still free. Next noteOn should take slot 1.
    const res2 = allocator.noteOn("D5", 4);
    expect(res2).toEqual({ index: 1, stolenKey: null, retrigger: false });
  });

  it("policy 4: steal ringing slot with smallest freeAt", () => {
    const allocator = new VoiceAllocator(2);
    allocator.noteOn("C4", 0); // slot 0
    allocator.noteOn("E4", 1); // slot 1

    // Release both with different release times
    allocator.noteOff("C4", 2, 5); // slot 0 freeAt 7
    allocator.noteOff("E4", 2, 2); // slot 1 freeAt 4

    // At now = 3, neither is free (freeAt > 3). Ringing slots: slot 1 (freeAt 4), slot 0 (freeAt 7).
    // Smallest freeAt is slot 1.
    const res = allocator.noteOn("G4", 3);
    expect(res).toEqual({ index: 1, stolenKey: "E4", retrigger: false });
    expect(allocator.indexOf("E4")).toBe(-1); // key mapping lost
    expect(allocator.indexOf("G4")).toBe(1);
  });

  it("policy 5: steal held slot with oldest start time when all are held", () => {
    const allocator = new VoiceAllocator(2);
    allocator.noteOn("C4", 10); // slot 0, start 10
    allocator.noteOn("E4", 12); // slot 1, start 12

    // Both held at now = 15. Steal oldest start time (slot 0, C4).
    const res = allocator.noteOn("G4", 15);
    expect(res).toEqual({ index: 0, stolenKey: "C4", retrigger: false });
    expect(allocator.indexOf("C4")).toBe(-1);
    expect(allocator.indexOf("G4")).toBe(0);
    expect(allocator.heldKeys()).toEqual(["G4", "E4"]);
  });

  it("should handle noteOff, releaseAll, indexOf, heldKeys, and invalid noteOff", () => {
    const allocator = new VoiceAllocator(2);
    allocator.noteOn("C4", 0);
    allocator.noteOn("E4", 1);

    expect(allocator.heldKeys()).toEqual(["C4", "E4"]);
    expect(allocator.indexOf("C4")).toBe(0);
    expect(allocator.indexOf("E4")).toBe(1);
    expect(allocator.indexOf("G4")).toBe(-1);

    // noteOff
    expect(allocator.noteOff("C4", 2, 1)).toBe(0);
    expect(allocator.heldKeys()).toEqual(["E4"]);
    // second noteOff for same key returns -1 because it is no longer held
    expect(allocator.noteOff("C4", 2, 1)).toBe(-1);
    // unknown key returns -1
    expect(allocator.noteOff("unknown", 2, 1)).toBe(-1);

    // releaseAll
    const released = allocator.releaseAll(5, 2);
    expect(released).toEqual([1]);
    expect(allocator.heldKeys()).toEqual([]);
  });
});
