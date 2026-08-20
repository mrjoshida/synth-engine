import { describe, it, expect, vi } from "vitest";

// Mock Tone.js
vi.mock("tone", () => {
  class MockGain {
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
    gain = { value: 1 };
  }

  class MockSampler {
    triggerAttackRelease = vi.fn();
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    releaseAll = vi.fn();
    connect = vi.fn();
    dispose = vi.fn();
    volume = { value: 0 };
    constructor(public options: any = {}) {
      if (options.onload) {
        setTimeout(options.onload, 5);
      }
    }
  }

  return {
    Gain: MockGain,
    Sampler: MockSampler
  };
});

import { SamplerVoice } from "../voices/SamplerVoice";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";

describe("SamplerVoice", () => {
  it("should instantiate cleanly", () => {
    const voice = new SamplerVoice();
    expect(voice).toBeDefined();
    expect(voice.getLoadedInstrumentId()).toBeNull();
    expect(voice.isLoadingInstrument()).toBe(false);
  });

  it("should report null output before init and gain output after init", async () => {
    const voice = new SamplerVoice();
    expect(voice.getOutput()).toBeNull();
    await voice.init();
    expect(voice.getOutput()).not.toBeNull();
  });

  it("should load instrument config successfully and update state", async () => {
    const voice = new SamplerVoice();
    await voice.init();
    const config = BUILTIN_INSTRUMENTS["grand-piano"];
    
    let loadedCallbackFired = false;
    voice.onLoad(() => {
      loadedCallbackFired = true;
    });

    await voice.loadInstrument(config);
    expect(voice.getLoadedInstrumentId()).toBe("grand-piano");
    expect(voice.isLoadingInstrument()).toBe(false);
    expect(loadedCallbackFired).toBe(true);
  });

  it("should handle rapid consecutive load calls and ignore stale earlier callbacks", async () => {
    const voice = new SamplerVoice();
    await voice.init();

    const p1 = voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);
    const p2 = voice.loadInstrument(BUILTIN_INSTRUMENTS["electric-piano"]);

    await Promise.all([p1, p2]);
    expect(voice.getLoadedInstrumentId()).toBe("electric-piano");
    expect(voice.isLoadingInstrument()).toBe(false);
  });

  it("should handle rapid consecutive reload calls of the same instrument without callback leakage", async () => {
    const voice = new SamplerVoice();
    await voice.init();

    let callbacksFired = 0;
    voice.onLoad(() => {
      callbacksFired++;
    });

    const p1 = voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);
    const p2 = voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);

    await Promise.all([p1, p2]);
    expect(voice.getLoadedInstrumentId()).toBe("grand-piano");
    expect(voice.isLoadingInstrument()).toBe(false);
    // Only the second/active request should trigger the final onLoad callback once settled
    expect(callbacksFired).toBe(1);
  });

  it("should auto-initialize output node when loadInstrument is called before init", async () => {
    const voice = new SamplerVoice();
    expect(voice.getOutput()).toBeNull();
    
    await voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);
    expect(voice.getOutput()).not.toBeNull();
    const mockSampler = (voice as any).sampler;
    expect(mockSampler.connect).toHaveBeenCalledWith(voice.getOutput());
  });

  it("should support specific note release as well as releaseAll", async () => {
    const voice = new SamplerVoice();
    await voice.init();
    await voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);

    const mockSampler = (voice as any).sampler;
    voice.triggerRelease("C4");
    expect(mockSampler.triggerRelease).toHaveBeenCalledWith("C4", undefined);

    // Empty array should fall back to releaseAll
    voice.triggerRelease([]);
    expect(mockSampler.releaseAll).toHaveBeenCalled();

    voice.triggerRelease();
    expect(mockSampler.releaseAll).toHaveBeenCalled();
  });

  it("should cleanly dispose sampler, output node, and clear callbacks", async () => {
    const voice = new SamplerVoice();
    await voice.init();
    voice.onLoad(() => {});
    await voice.loadInstrument(BUILTIN_INSTRUMENTS["grand-piano"]);
    
    expect(voice.getLoadedInstrumentId()).toBe("grand-piano");
    voice.dispose();
    expect(voice.getLoadedInstrumentId()).toBeNull();
    expect((voice as any).onLoadCallbacks).toEqual([]);
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
