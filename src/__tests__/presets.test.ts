import { describe, it, expect } from "vitest";
import { BUILTIN_SYNTH_PRESETS } from "../presets/builtinPresets";
import { PresetManager } from "../presets/PresetManager";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";

const VALID_CATEGORIES = ["pad", "lead", "pluck", "bass", "drone", "percussion", "bell", "keys"];
const VALID_ENGINE_TYPES = ["poly", "fm", "pluck", "moog", "drone", "membrane", "sampler"];

describe("Preset System", () => {
  it("should contain at least 22 builtin presets", () => {
    expect(BUILTIN_SYNTH_PRESETS.length).toBeGreaterThanOrEqual(22);
  });

  it("should have all required fields for every builtin preset", () => {
    BUILTIN_SYNTH_PRESETS.forEach((p) => {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(VALID_CATEGORIES).toContain(p.category);
      expect(VALID_ENGINE_TYPES).toContain(p.engineType);
      expect(p.envelope).toBeDefined();
      expect(p.envelope.attack).toBeGreaterThanOrEqual(0);
      expect(p.envelope.decay).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have unique IDs across all presets", () => {
    const ids = BUILTIN_SYNTH_PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have valid samplerConfig for sampler engine presets", () => {
    const samplerPresets = BUILTIN_SYNTH_PRESETS.filter(p => p.engineType === "sampler");
    expect(samplerPresets.length).toBeGreaterThanOrEqual(3);

    samplerPresets.forEach((p) => {
      expect(p.samplerConfig).toBeDefined();
      expect(p.samplerConfig!.instrumentId).toBeDefined();
      expect(BUILTIN_INSTRUMENTS[p.samplerConfig!.instrumentId]).toBeDefined();
    });
  });

  it("should serialize and deserialize presets through PresetManager", () => {
    const manager = new PresetManager();
    const json = manager.serialize();
    expect(typeof json).toBe("string");

    const newManager = new PresetManager();
    const success = newManager.deserialize(json);
    expect(success).toBe(true);
    expect(newManager.getAll().length).toBe(BUILTIN_SYNTH_PRESETS.length);
  });
});
