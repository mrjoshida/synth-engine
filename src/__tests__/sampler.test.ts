import { describe, it, expect } from "vitest";
import { SamplerVoice } from "../voices/SamplerVoice";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";

describe("SamplerVoice", () => {
  it("should instantiate cleanly", () => {
    const voice = new SamplerVoice();
    expect(voice).toBeDefined();
    expect(voice.getLoadedInstrumentId()).toBeNull();
    expect(voice.isLoadingInstrument()).toBe(false);
  });

  it("should report null output before init", () => {
    const voice = new SamplerVoice();
    expect(voice.getOutput()).toBeNull();
  });
});

describe("BUILTIN_INSTRUMENTS", () => {
  it("should have at least 4 built-in instruments", () => {
    const ids = Object.keys(BUILTIN_INSTRUMENTS);
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });

  it("should have valid config for each instrument", () => {
    Object.entries(BUILTIN_INSTRUMENTS).forEach(([id, config]) => {
      expect(config.id).toBe(id);
      expect(config.name).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.baseUrl.startsWith("https://")).toBe(true);
      expect(Object.keys(config.sampleMap).length).toBeGreaterThan(0);
    });
  });

  it("should have sample map entries ending with .mp3", () => {
    Object.values(BUILTIN_INSTRUMENTS).forEach(config => {
      Object.values(config.sampleMap).forEach(filename => {
        expect(filename.endsWith(".mp3")).toBe(true);
      });
    });
  });
});
