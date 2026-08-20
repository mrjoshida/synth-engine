import { describe, it, expect } from "vitest";
import { SynthEngine } from "../engine/SynthEngine";

describe("SynthEngine Coordinator", () => {
  it("should instantiate all voices and managers cleanly", () => {
    const engine = new SynthEngine();
    expect(engine.polyVoice).toBeDefined();
    expect(engine.fmVoice).toBeDefined();
    expect(engine.pluckVoice).toBeDefined();
    expect(engine.moogVoice).toBeDefined();
    expect(engine.droneVoice).toBeDefined();
    expect(engine.membraneVoice).toBeDefined();
    expect(engine.samplerVoice).toBeDefined();
    expect(engine.fxRack).toBeDefined();
    expect(engine.webMidi).toBeDefined();
    expect(engine.presets).toBeDefined();
  });

  it("should return the correct voice for each engine type", () => {
    const engine = new SynthEngine();
    expect(engine.getVoice("poly")).toBe(engine.polyVoice);
    expect(engine.getVoice("fm")).toBe(engine.fmVoice);
    expect(engine.getVoice("pluck")).toBe(engine.pluckVoice);
    expect(engine.getVoice("moog")).toBe(engine.moogVoice);
    expect(engine.getVoice("drone")).toBe(engine.droneVoice);
    expect(engine.getVoice("membrane")).toBe(engine.membraneVoice);
    expect(engine.getVoice("sampler")).toBe(engine.samplerVoice);
  });
});
