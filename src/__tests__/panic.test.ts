import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tone.js with automation spies for hard-mute verification
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

  class MockParam {
    value: number | string;
    cancelScheduledValues = vi.fn().mockReturnThis();
    setValueAtTime = vi.fn().mockReturnThis();
    linearRampToValueAtTime = vi.fn().mockReturnThis();
    rampTo = vi.fn().mockReturnThis();

    constructor(initial: number | string) {
      this.value = initial;
    }
  }

  class MockGain extends MockNode {
    gain: MockParam;
    constructor(val = 0.85) {
      super();
      this.gain = new MockParam(val);
    }
  }

  class MockFreeverb extends MockNode {
    wet: MockParam;
    roomSize: MockParam;
    dampening = { value: 3500 };
    constructor(opts: any = {}) {
      super();
      this.wet = new MockParam(opts.wet !== undefined ? opts.wet : 0.15);
      this.roomSize = new MockParam(opts.roomSize !== undefined ? opts.roomSize : 0.75);
    }
  }

  class MockFeedbackDelay extends MockNode {
    wet: MockParam;
    delayTime: MockParam;
    feedback: MockParam;
    constructor(opts: any = {}) {
      super();
      this.wet = new MockParam(opts.wet !== undefined ? opts.wet : 0.0);
      this.delayTime = new MockParam(opts.delayTime !== undefined ? opts.delayTime : "8n.");
      this.feedback = new MockParam(opts.feedback !== undefined ? opts.feedback : 0.3);
    }
  }

  class MockChorus extends MockNode {
    wet = new MockParam(0.0);
    frequency = new MockParam(1.5);
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
    releaseAtTriggerRelease: number[] = [];
    triggerRelease = vi.fn(() => {
      this.releaseAtTriggerRelease.push(this.envelope.release);
    });
    triggerAttackRelease = vi.fn();
    volume = { value: 0 };
    releaseAll = vi.fn();
    envelope: any = {
      set: vi.fn((opts: any) => {
        if (opts?.release !== undefined) {
          this.envelope.release = opts.release;
        }
      }),
      release: 1.4,
    };
    filter = {
      frequency: new MockParam(4500),
      Q: new MockParam(1.5),
      type: "lowpass",
      rolloff: -24,
    };
    oscillator = { set: vi.fn() };
    pitchDecay = 0.05;
    octaves = 8;
    release = 1;

    set = vi.fn((opts: any) => {
      if (opts?.envelope?.release !== undefined) {
        this.envelope.release = opts.envelope.release;
      }
    });

    get = vi.fn(() => ({ envelope: { release: this.envelope.release } }));
  }

  class MockSampler extends MockSynthVoice {
    loaded = true;
    _activeSources = new Map<number, any[]>();
    constructor(opts: any = {}) {
      super();
      if (opts.onload) setTimeout(opts.onload, 0);
    }
  }

  class MockChebyshev extends MockNode {
    order = 1;
  }

  class MockFilter extends MockNode {
    frequency = new MockParam(4500);
    Q = new MockParam(1);
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

  let mockNowTime = 100;

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
    Time: vi.fn((t) => ({
      toSeconds: () => (typeof t === "number" ? t : 0.5),
    })),
    getDestination: () => new MockNode(),
    now: vi.fn(() => mockNowTime),
    start: vi.fn().mockResolvedValue(undefined),
    Transport: {
      state: "stopped",
      bpm: { value: 120 },
      swing: 0,
      swingSubdivision: "8n",
      start: vi.fn(),
      stop: vi.fn(),
    },
    __setMockNow: (val: number) => { mockNowTime = val; },
  };
});

import { SynthEngine } from "../engine/SynthEngine";
import * as Tone from "tone";

describe("Hard-Mute Panic (v0.4.1)", () => {
  let engine: SynthEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    (Tone as any).__setMockNow(100);
    engine = new SynthEngine();
    await engine.init();
  });

  it("panic() on a held moog note uses a 0.01 s release, then restores the original release", () => {
    engine.noteOn("C3", 0.8, { voiceType: "moog" });

    const moogVoice = engine.moogVoice as any;
    const synth = moogVoice.synths[0];
    expect(synth).toBeDefined();

    const origRelease = synth.envelope.release;
    expect(origRelease).toBeGreaterThan(0.01);

    engine.panic();

    expect(synth.releaseAtTriggerRelease).toContain(0.01);
    expect(synth.envelope.release).toBe(origRelease);
  });

  it("the PolySynth path: release set to 0.01, releaseAll, release restored", () => {
    const polyVoice = engine.polyVoice as any;
    const polySynth = polyVoice.polySynth;
    expect(polySynth).toBeDefined();

    const events: string[] = [];
    polySynth.set.mockImplementation((opts: any) => {
      if (opts?.envelope?.release !== undefined) {
        polySynth.envelope.release = opts.envelope.release;
        events.push(`set:${opts.envelope.release}`);
      }
    });
    polySynth.releaseAll.mockImplementation(() => {
      events.push(`releaseAll@${polySynth.envelope.release}`);
    });

    engine.panic();

    // The short release must be in effect while releaseAll runs, then the original is restored.
    expect(events).toEqual(["set:0.01", "releaseAll@0.01", "set:1.4"]);
    expect(polySynth.envelope.release).toBe(1.4);
  });

  it("master gain automation reaches 0 by now + 0.01 and ramps back to masterVolume at now + 0.12", () => {
    const masterGain = (engine.fxRack as any).masterGain;
    const gainParam = masterGain.gain;

    engine.panic();

    expect(gainParam.cancelScheduledValues).toHaveBeenCalledWith(100);
    expect(gainParam.setValueAtTime).toHaveBeenCalledWith(0.85, 100);
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(0, 100.01);
    expect(gainParam.setValueAtTime).toHaveBeenCalledWith(0, 100.1);
    expect(gainParam.linearRampToValueAtTime.mock.calls[1][0]).toBe(0.85);
    expect(gainParam.linearRampToValueAtTime.mock.calls[1][1]).toBeCloseTo(100.12, 3);
  });

  it("delay feedback/wet muted and restored after the delay time (use a numeric delayTime)", () => {
    engine.fxRack.setConfig({ delayTime: 0.25, delayFeedback: 0.4, delayWet: 0.3 });

    const delay = (engine.fxRack as any).delay;
    const fbParam = delay.feedback;
    const wetParam = delay.wet;

    // expected restoreTime = 100 + 0.01 + 0.25 + 0.05 = 100.31
    engine.panic();

    expect(fbParam.linearRampToValueAtTime).toHaveBeenCalledWith(0, 100.01);
    expect(fbParam.setValueAtTime).toHaveBeenCalledWith(0.4, 100.31);

    expect(wetParam.linearRampToValueAtTime).toHaveBeenCalledWith(0, 100.01);
    expect(wetParam.setValueAtTime).toHaveBeenCalledWith(0.3, 100.31);
  });

  it("reverb roomSize muted and restored", () => {
    const reverb = (engine.fxRack as any).reverb;
    const roomSizeParam = reverb.roomSize;

    engine.panic();

    expect(roomSizeParam.setValueAtTime).toHaveBeenCalledWith(0, 100.01);
    expect(roomSizeParam.setValueAtTime).toHaveBeenCalledWith(0.75, 100.1);
  });

  it("releaseAll() does NOT touch master gain automation", () => {
    const masterGain = (engine.fxRack as any).masterGain;
    const gainParam = masterGain.gain;

    engine.releaseAll();

    expect(gainParam.cancelScheduledValues).not.toHaveBeenCalled();
    expect(gainParam.setValueAtTime).not.toHaveBeenCalled();
    expect(gainParam.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("panic() before init does not throw", () => {
    const uninitEngine = new SynthEngine();
    expect(() => uninitEngine.panic()).not.toThrow();
  });

  it("after panic(), noteOn/noteOff route normally", () => {
    const polyVoice = engine.polyVoice as any;
    const polySynth = polyVoice.polySynth;

    engine.noteOn("C4", 0.8, { voiceType: "poly" });
    expect(polySynth.triggerAttack).toHaveBeenCalledWith("C4", undefined, 0.8);

    engine.panic();

    polySynth.triggerAttack.mockClear();
    polySynth.triggerRelease.mockClear();

    engine.noteOn("E4", 0.9, { voiceType: "poly" });
    expect(polySynth.triggerAttack).toHaveBeenCalledWith("E4", undefined, 0.9);

    engine.noteOff("E4", { voiceType: "poly" });
    expect(polySynth.triggerRelease).toHaveBeenCalledWith("E4", undefined);
  });

  it("re-entrant panic during mute window preserves original restore targets", () => {
    engine.fxRack.setConfig({ masterVolume: 0.8, delayFeedback: 0.35, delayWet: 0.25 });
    const masterGain = (engine.fxRack as any).masterGain;
    const gainParam = masterGain.gain;

    // First panic at t = 100
    engine.panic();

    // In mid-mute (e.g. t = 100.005), the params read back transient (muted) values
    gainParam.value = 0.05;
    const delay = (engine.fxRack as any).delay;
    delay.feedback.value = 0;
    delay.wet.value = 0;
    (Tone as any).__setMockNow(100.005);

    // Second panic at t = 100.005
    engine.panic();

    // Targets must still be the pre-mute values, not the transient ones
    const lastRampCall = gainParam.linearRampToValueAtTime.mock.calls[gainParam.linearRampToValueAtTime.mock.calls.length - 1];
    expect(lastRampCall[0]).toBe(0.8);
    const fbCalls = delay.feedback.setValueAtTime.mock.calls;
    const wetCalls = delay.wet.setValueAtTime.mock.calls;
    expect(fbCalls[fbCalls.length - 1][0]).toBe(0.35);
    expect(wetCalls[wetCalls.length - 1][0]).toBe(0.25);
  });

  it("getConfig() during mute window reports cached pre-mute values", () => {
    engine.fxRack.setConfig({ masterVolume: 0.75, delayFeedback: 0.4, delayWet: 0.2 });
    const masterGain = (engine.fxRack as any).masterGain;
    const delay = (engine.fxRack as any).delay;

    engine.panic();

    // Tone parameters may be zeroed
    masterGain.gain.value = 0;
    delay.feedback.value = 0;
    delay.wet.value = 0;

    const config = engine.fxRack.getConfig();
    expect(config.masterVolume).toBe(0.75);
    expect(config.delayFeedback).toBe(0.4);
    expect(config.delayWet).toBe(0.2);
  });

  it("setConfig() during mute window cancels restore schedule and applies new value", () => {
    const masterGain = (engine.fxRack as any).masterGain;
    const gainParam = masterGain.gain;

    engine.panic();

    // Call setConfig while mute is in flight
    (Tone as any).__setMockNow(100.05);
    engine.fxRack.setConfig({ masterVolume: 0.5 });

    expect(gainParam.cancelScheduledValues).toHaveBeenCalledWith(100.05);
    expect(engine.fxRack.getConfig().masterVolume).toBe(0.5);
  });

  it("MoogVoice allocator floor regression test: short patch release does not alter allocator floor or synth release", () => {
    const moogVoice = engine.moogVoice as any;
    // Apply patch with release = 0.3s
    moogVoice.applyPatch({
      name: "ShortRel",
      category: "lead",
      engineType: "moog",
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
    });

    engine.noteOn("C3", 0.8, { voiceType: "moog" });
    const synth = moogVoice.synths[0];

    // Allocator releaseSeconds floor must remain >= 0.8
    expect(moogVoice.releaseSeconds(synth)).toBe(0.8);
    expect(synth.envelope.release).toBe(0.3);

    engine.panic();

    // After panic, release should be restored to 0.3
    expect(synth.envelope.release).toBe(0.3);
    expect(moogVoice.releaseSeconds(synth)).toBe(0.8);
  });

  it("SamplerVoice hardStop mutates active sources fadeOut to HARD_STOP_RELEASE_S", async () => {
    const samplerVoice = engine.samplerVoice as any;
    samplerVoice.sampler = new (Tone as any).Sampler();
    const mockSource1 = { fadeOut: 2.0 };
    const mockSource2 = { fadeOut: 1.5 };
    samplerVoice.sampler._activeSources.set(60, [mockSource1]);
    samplerVoice.sampler._activeSources.set(64, [mockSource2]);

    engine.panic();

    expect(mockSource1.fadeOut).toBe(0.01);
    expect(mockSource2.fadeOut).toBe(0.01);
    expect(samplerVoice.sampler.releaseAll).toHaveBeenCalledWith(100);
  });
});
