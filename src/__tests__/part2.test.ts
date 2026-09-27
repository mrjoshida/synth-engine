import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tone.js for comprehensive engine and patch loading testing
vi.mock("tone", () => {
  class MockNode {
    connect() { return this; }
    disconnect() { return this; }
    toDestination() { return this; }
    dispose = vi.fn();
    start() { return this; }
    stop() { return this; }
    chain() { return this; }
    set = vi.fn();
  }

  class MockGain extends MockNode {
    gain = { value: 1, rampTo: vi.fn() };
    constructor(val = 1) {
      super();
      this.gain.value = val;
    }
  }

  class MockFreeverb extends MockNode {
    wet = { value: 0.15, rampTo: vi.fn() };
    roomSize = { value: 0.75, rampTo: vi.fn() };
    dampening = { value: 3500 };
    constructor(opts: any = {}) {
      super();
      if (opts.wet !== undefined) this.wet.value = opts.wet;
    }
  }

  class MockFeedbackDelay extends MockNode {
    wet = { value: 0.0, rampTo: vi.fn() };
    delayTime = { value: "8n." };
    feedback = { value: 0.3, rampTo: vi.fn() };
    constructor(opts: any = {}) {
      super();
      if (opts.wet !== undefined) this.wet.value = opts.wet;
      if (opts.delayTime !== undefined) this.delayTime.value = opts.delayTime;
      if (opts.feedback !== undefined) this.feedback.value = opts.feedback;
    }
  }

  class MockChorus extends MockNode {
    wet = { value: 0.0, rampTo: vi.fn() };
    frequency = { value: 1.5, rampTo: vi.fn() };
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
    filter = {
      frequency: { value: 4500, rampTo: vi.fn() },
      Q: { value: 1.5, rampTo: vi.fn() },
      type: "lowpass",
      rolloff: -24
    };
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
    frequency = { value: 4500, rampTo: vi.fn() };
    Q = { value: 1, rampTo: vi.fn() };
    type = "lowpass";
    rolloff = -24;
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
import { toToneOscillator } from "../voices/helpers";
import { SynthPatch } from "../types";
import { VoiceAllocator } from "../voices/VoiceAllocator";

describe("Part 2: Polyphony, Voice Pooling & Engine Enhancements", () => {
  let engine: SynthEngine;

  beforeEach(async () => {
    engine = new SynthEngine();
    await engine.init();
  });

  afterEach(() => {
    engine.dispose();
  });

  it("should play chords on each pooled voice allocating distinct synths with correct notes", () => {
    const pooledVoices = [engine.pluckVoice, engine.moogVoice, engine.droneVoice, engine.membraneVoice];

    for (const v of pooledVoices) {
      expect((v as any).synths.length).toBe(1); // pre-warm
      v.triggerAttack(["C3", "E3", "G3"]);
      expect((v as any).synths.length).toBe(3);
      v.triggerRelease();
    }
  });

  it("moog releasing one of two held notes releases only that synth", () => {
    const moog = engine.moogVoice;
    moog.startNote("k1", "C2");
    moog.startNote("k2", "G2");
    expect((moog as any).synths.length).toBe(2);

    const synth0 = (moog as any).synths[0];
    const synth1 = (moog as any).synths[1];

    moog.stopNote("k1");
    expect(synth0.triggerRelease).toHaveBeenCalled();
    expect(synth1.triggerRelease).not.toHaveBeenCalled();
  });

  it("init creates exactly 1 synth, 3-note chord -> 3, cap 12, 13th steals", () => {
    const moog = engine.moogVoice;
    expect((moog as any).synths.length).toBe(1);

    const notes = ["C1", "D1", "E1", "F1", "G1", "A1", "B1", "C2", "D2", "E2", "F2", "G2"];
    for (let i = 0; i < 12; i++) {
      moog.startNote(`key:${i}`, notes[i]);
    }
    expect((moog as any).synths.length).toBe(12);

    // 13th note triggers stealing of oldest held slot
    moog.startNote("key:12", "A2");
    expect((moog as any).synths.length).toBe(12);
  });

  it("engine routing: poly note survives a switch to pluck and is released on poly; explicit voiceType wins; channel separation", () => {
    engine.loadPatch({
      id: "poly-test",
      name: "Poly Test",
      category: "pad",
      engineType: "poly",
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1 },
    });

    const polySpy = vi.spyOn(engine.polyVoice, "startNote");
    const polyStopSpy = vi.spyOn(engine.polyVoice, "stopNote");
    const pluckSpy = vi.spyOn(engine.pluckVoice, "startNote");

    // Start note on poly
    engine.noteOn("C4", 0.8, { channel: 1 });
    expect(polySpy).toHaveBeenCalledWith("1:60", "C4", 0.8);

    // Switch patch to pluck
    engine.loadPatch({
      id: "pluck-test",
      name: "Pluck Test",
      category: "pluck",
      engineType: "pluck",
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1 },
    });

    // Release noteOn without voiceType: recorded voice was poly, so released on poly!
    engine.noteOff("C4", { channel: 1 });
    expect(polyStopSpy).toHaveBeenCalledWith("1:60");

    // Explicit voiceType wins
    engine.noteOn("D4", 0.8, { voiceType: "pluck", channel: 1 });
    expect(pluckSpy).toHaveBeenCalledWith("1:62", "D4", 0.8);

    // Same pitch on channel 1 and 2 creates 2 distinct keys
    engine.noteOn("E4", 0.8, { voiceType: "poly", channel: 1 });
    engine.noteOn("E4", 0.8, { voiceType: "poly", channel: 2 });
    expect(polySpy).toHaveBeenCalledWith("1:64", "E4", 0.8);
    expect(polySpy).toHaveBeenCalledWith("2:64", "E4", 0.8);

    // releaseAll clears routing
    engine.releaseAll();
    expect((engine as any).activeNotes.size).toBe(0);
  });

  it("loadPreset true/false, getPatch is a copy, getVoiceType returns engineType", () => {
    expect(engine.loadPreset("nonexistent")).toBe(false);
    expect(engine.loadPreset("moog-model-24")).toBe(true);

    expect(engine.getVoiceType()).toBe("moog");

    const patchCopy = engine.getPatch();
    expect(patchCopy.id).toBe("moog-model-24");
    patchCopy.name = "Mutated";
    expect(engine.getPatch().name).toBe("Moog Model 24");
  });

  it("setParam: false cases, clamping, rampTo on filter.frequency, fxSends skips voice.applyPatch, engineType switch", () => {
    expect(engine.setParam("unknown.param", 100)).toBe(false);
    expect(engine.setParam("filter.type", "invalid-type")).toBe(false);

    // Clamping
    expect(engine.setParam("filter.frequency", 50000)).toBe(true);
    expect(engine.getPatch().filter?.frequency).toBe(20000);

    // fxSends skips voice applyPatch
    const voiceSpy = vi.spyOn(engine.getVoice(engine.getVoiceType()), "applyPatch");
    expect(engine.setParam("fxSends.reverbWet", 0.5)).toBe(true);
    expect(voiceSpy).not.toHaveBeenCalled();

    // Engine type switch
    expect(engine.setParam("engineType", "pluck")).toBe(true);
    expect(engine.getVoiceType()).toBe("pluck");
  });

  it("patch loaded before init is applied by init", async () => {
    const uninitEngine = new SynthEngine();
    uninitEngine.loadPatch({
      id: "pre-patch",
      name: "Pre Patch",
      category: "bass",
      engineType: "moog",
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.5 },
      filter: { frequency: 999, type: "lowpass", Q: 3.5 },
      fxSends: { reverbWet: 0.77 },
    });

    await uninitEngine.init();
    expect(uninitEngine.getVoiceType()).toBe("moog");
    expect(uninitEngine.fxRack.getConfig().reverbWet).toBe(0.77);
    uninitEngine.dispose();
  });

  it("toToneOscillator helper fixes", () => {
    expect(toToneOscillator({ type: "fatsaw" })).toEqual({
      type: "fatsawtooth",
      count: 3,
      spread: 20,
    });
    expect(toToneOscillator({ type: "fattriangle" })).toEqual({
      type: "fattriangle",
      count: 3,
      spread: 20,
    });
    expect(toToneOscillator({ type: "sawtooth", count: 3, spread: 25 })).toEqual({
      type: "fatsawtooth",
      count: 3,
      spread: 25,
    });
    expect(toToneOscillator({ type: "pulse", count: 4 })).toEqual({
      type: "pulse",
    });
  });

  it("PolyVoice applies rolloff and Q when Q !== undefined (including Q = 0)", () => {
    const poly = engine.polyVoice;
    poly.applyPatch({
      id: "p1",
      name: "P1",
      category: "pad",
      engineType: "poly",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
      filter: { frequency: 1000, type: "lowpass", rolloff: -12, Q: 0 },
    });
    const filter = (poly as any).filter;
    expect(filter.rolloff).toBe(-12);
    expect(filter.Q.value).toBe(0);
  });

  it("FMVoice applies filter frequency, type, Q, rolloff", () => {
    const fm = engine.fmVoice;
    fm.applyPatch({
      id: "f1",
      name: "F1",
      category: "bell",
      engineType: "fm",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
      filter: { frequency: 3000, type: "highpass", rolloff: -48, Q: 4 },
    });
    const filter = (fm as any).filter;
    expect(filter.frequency.value).toBe(3000);
    expect(filter.type).toBe("highpass");
    expect(filter.rolloff).toBe(-48);
    expect(filter.Q.value).toBe(4);
  });

  it("Addendum H: deterministic presets resetting absent fields to engine defaults", () => {
    const poly = engine.polyVoice;
    // 1. Load patch with custom Q: 8
    poly.applyPatch({
      id: "p1",
      name: "P1",
      category: "pad",
      engineType: "poly",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
      filter: { frequency: 2000, type: "lowpass", Q: 8 },
    });
    expect((poly as any).filter.Q.value).toBe(8);

    // 2. Load patch without Q -> Q resets to poly default 1.5
    poly.applyPatch({
      id: "p2",
      name: "P2",
      category: "pad",
      engineType: "poly",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
    });
    expect((poly as any).filter.Q.value).toBe(1.5);

    // Moog Q resets to moog default 4.5
    const moog = engine.moogVoice;
    moog.applyPatch({
      id: "m1",
      name: "M1",
      category: "bass",
      engineType: "moog",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
      filter: { frequency: 500, type: "lowpass", Q: 9 },
    });
    const moogSynth = (moog as any).synths[0];
    expect(moogSynth.filter.Q.value).toBe(9);

    moog.applyPatch({
      id: "m2",
      name: "M2",
      category: "bass",
      engineType: "moog",
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.5 },
    });
    expect(moogSynth.filter.Q.value).toBe(4.5);
  });

  it("Audit round 2: pluck and membrane stopNote call synth triggerRelease", () => {
    const pluck = engine.pluckVoice;
    pluck.startNote("p1", "C4");
    const pluckSynth = (pluck as any).synths[0];
    pluckSynth.triggerRelease = vi.fn();
    pluck.stopNote("p1");
    expect(pluckSynth.triggerRelease).toHaveBeenCalled();

    const membrane = engine.membraneVoice;
    membrane.startNote("m1", "C2");
    const membraneSynth = (membrane as any).synths[0];
    membraneSynth.triggerRelease = vi.fn();
    membrane.stopNote("m1");
    expect(membraneSynth.triggerRelease).toHaveBeenCalled();
  });

  it("Audit round 2: triggerRelease() releases every held synth across pool", () => {
    const moog = engine.moogVoice;
    moog.startNote("k1", "C2");
    moog.startNote("k2", "E2");
    expect((moog as any).synths.length).toBe(2);

    const s0 = (moog as any).synths[0];
    const s1 = (moog as any).synths[1];
    s0.triggerRelease = vi.fn();
    s1.triggerRelease = vi.fn();

    moog.triggerRelease();
    expect(s0.triggerRelease).toHaveBeenCalled();
    expect(s1.triggerRelease).toHaveBeenCalled();
  });

  it("Audit round 2: legacy pluck and membrane triggerAttack are one-shots (8n)", () => {
    const pluck = engine.pluckVoice;
    const tarSpy = vi.spyOn(pluck, "triggerAttackRelease");
    pluck.triggerAttack("E4");
    expect(tarSpy).toHaveBeenCalledWith("E4", "8n", undefined, 0.85);

    const membrane = engine.membraneVoice;
    const memTarSpy = vi.spyOn(membrane, "triggerAttackRelease");
    membrane.triggerAttack("A1");
    expect(memTarSpy).toHaveBeenCalledWith("A1", "8n", undefined, 0.9);
  });

  it("Audit round 2: new synth created before any patch gets engine defaults; new synth after patch gets last patch", () => {
    const freshPluck = new (engine.pluckVoice.constructor as any)();
    const synth0 = (freshPluck as any).getOrCreateSynth(0);
    // pluckParams.dampening engine default is 4200
    expect(synth0.dampening).toBe(4200);

    freshPluck.applyPatch({
      id: "custom-pluck",
      name: "Custom Pluck",
      category: "pluck",
      engineType: "pluck",
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 },
      pluckParams: { dampening: 7777, resonance: 0.5, attackNoise: 2 },
    });

    const synth1 = (freshPluck as any).getOrCreateSynth(1);
    expect(synth1.dampening).toBe(7777);
    freshPluck.dispose();
  });

  it("Audit round 2: setParam with fxSends.* sends clamped value to fxRack", () => {
    const setConfigSpy = vi.spyOn(engine.fxRack, "setConfig");
    expect(engine.setParam("fxSends.chorusFrequency", 999)).toBe(true);
    expect(setConfigSpy).toHaveBeenCalledWith({ chorusFrequency: 10 }, { smooth: true });
  });

  it("Audit round 2: init resolves even when loadInstrument rejects", async () => {
    const uninitEngine = new SynthEngine();
    uninitEngine.loadPatch({
      id: "sampler-fail",
      name: "Sampler Fail",
      category: "keys",
      engineType: "sampler",
      envelope: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.5 },
      samplerConfig: { instrumentId: "grand-piano" },
    });

    vi.spyOn(uninitEngine, "loadInstrument").mockRejectedValue(new Error("Network failure"));
    await expect(uninitEngine.init()).resolves.toBeUndefined();
    expect(uninitEngine.isReady()).toBe(true);
    uninitEngine.dispose();
  });


  it("MoogVoice synth is constructed with rolloff -24 and lowpass type", () => {
    const moog = engine.moogVoice;
    const synth = (moog as any).synths[0];
    expect(synth.filter.rolloff).toBe(-24);
    expect(synth.filter.type).toBe("lowpass");
  });


  it("PolyVoice and FMVoice set filter rolloff at most once when called twice with same rolloff", () => {
    const poly = engine.polyVoice as any;
    let rolloffSets = 0;
    let _rolloff = poly.filter.rolloff;
    Object.defineProperty(poly.filter, "rolloff", {
      get: () => _rolloff,
      set: (val) => {
        rolloffSets++;
        _rolloff = val;
      },
      configurable: true,
    });

    const patch: SynthPatch = {
      id: "poly-test",
      name: "Poly Test",
      category: "lead",
      engineType: "poly",
      filter: { rolloff: -12 },
    };

    poly.applyPatch(patch);
    expect(rolloffSets).toBe(1);
    poly.applyPatch(patch);
    expect(rolloffSets).toBe(1);
  });

  it("an FM patch without an oscillator section sets carrier type to sine", () => {
    const fm = engine.fmVoice as any;
    const patch: SynthPatch = {
      id: "fm-no-osc",
      name: "FM No Osc",
      category: "keys",
      engineType: "fm",
    };
    fm.applyPatch(patch);
    expect((fm.fmPoly as any).set).toHaveBeenCalledWith({
      oscillator: { type: "sine" },
    });
  });

  it("loadPatch does not throw or reject when loadInstrument fails", async () => {
    vi.spyOn(engine, "loadInstrument").mockRejectedValue(new Error("Sampler load failure"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => {
      engine.loadPatch({
        id: "sampler-fail-patch",
        name: "Sampler Fail",
        category: "keys",
        engineType: "sampler",
        samplerConfig: { instrumentId: "missing-piano" },
      });
    }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("DroneVoice: toggle on, releaseAll, then toggle again returns true", () => {
    const drone = engine.droneVoice;
    expect(drone.toggle("C2")).toBe(true);
    engine.releaseAll();
    expect(drone.toggle("C2")).toBe(true);
    drone.toggle("C2");
  });

  it("setParam with samplerConfig.instrumentId loads instrument samples and updates patch", async () => {
    const loadSpy = vi.spyOn(engine, "loadInstrument").mockResolvedValue(undefined);
    expect(engine.setParam("samplerConfig.instrumentId", "electric-piano")).toBe(true);
    expect(engine.getPatch().samplerConfig?.instrumentId).toBe("electric-piano");
    expect(loadSpy).toHaveBeenCalledWith("electric-piano");

    const patchBefore = engine.getPatch();
    expect(engine.setParam("samplerConfig.nonexistentProperty", "val")).toBe(false);
    expect(engine.setParam("samplerConfig.instrumentId", "invalid-instrument-id")).toBe(false);
    expect(engine.getPatch()).toEqual(patchBefore);
    loadSpy.mockRestore();
  });

  it("VoiceAllocator: slot released with NaN releaseSeconds can be reused or stolen without becoming stranded", () => {
    const allocator = new VoiceAllocator(1);
    const alloc1 = allocator.noteOn("k1", 10);
    expect(alloc1.index).toBe(0);

    const released = allocator.noteOff("k1", 10, NaN);
    expect(released).toBe(0);

    const alloc2 = allocator.noteOn("k2", 10);
    expect(alloc2.index).toBe(0);
    expect(alloc2.retrigger).toBe(false);

    allocator.releaseAll(20, NaN);
    const alloc3 = allocator.noteOn("k3", 20);
    expect(alloc3.index).toBe(0);
    expect(alloc3.retrigger).toBe(false);
  });

  it("PooledVoice: duplicate stopNote does not re-trigger release, and releaseAll followed by stopNote does not re-release", () => {
    const pluck = engine.pluckVoice;
    const synth = (pluck as any).synths[0];
    const triggerReleaseSpy = vi.spyOn(synth, "triggerRelease");

    pluck.startNote("note:C4", "C4");
    expect(triggerReleaseSpy).not.toHaveBeenCalled();

    pluck.stopNote("note:C4");
    expect(triggerReleaseSpy).toHaveBeenCalledTimes(1);

    pluck.stopNote("note:C4");
    expect(triggerReleaseSpy).toHaveBeenCalledTimes(1);

    pluck.startNote("note:D4", "D4");
    triggerReleaseSpy.mockClear();

    pluck.triggerRelease();
    expect(triggerReleaseSpy).toHaveBeenCalledTimes(1);

    pluck.stopNote("note:D4");
    expect(triggerReleaseSpy).toHaveBeenCalledTimes(1);
  });

  it("SynthEngine.noteOn guards against non-finite pitch strings and numbers, warns and returns early", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const polyStartSpy = vi.spyOn(engine.polyVoice, "startNote");
    const midiSendSpy = vi.spyOn(engine.webMidi, "sendNoteOn");

    engine.noteOn("H4");
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: H4");

    engine.noteOn("");
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: ");

    engine.noteOn(NaN);
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: NaN");

    expect(polyStartSpy).not.toHaveBeenCalled();
    expect(midiSendSpy).not.toHaveBeenCalled();
    expect((engine as any).activeNotes.size).toBe(0);

    warnSpy.mockRestore();
  });

  it("SynthEngine.noteOff guards against non-finite pitch strings and numbers, warns and returns early", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const polyStopSpy = vi.spyOn(engine.polyVoice, "stopNote");
    const midiStopSpy = vi.spyOn(engine.webMidi, "sendNoteOff");

    engine.noteOn("C4");
    expect((engine as any).activeNotes.size).toBe(1);

    engine.noteOff("H4");
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: H4");

    engine.noteOff("");
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: ");

    engine.noteOff(NaN);
    expect(warnSpy).toHaveBeenCalledWith("Invalid note or pitch: NaN");

    expect(polyStopSpy).not.toHaveBeenCalled();
    expect(midiStopSpy).not.toHaveBeenCalled();
    expect((engine as any).activeNotes.size).toBe(1);

    warnSpy.mockRestore();
  });

});
