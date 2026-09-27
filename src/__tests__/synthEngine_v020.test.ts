import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { MockContext, activeContext } = vi.hoisted(() => {
  class MockAudioContext {
    public state: "suspended" | "running" | "closed" | "interrupted" = "running";
    private listeners: Record<string, Function[]> = {};

    addEventListener(event: string, fn: Function) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }

    removeEventListener(event: string, fn: Function) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
    }

    dispatchEvent(event: { type: string }) {
      (this.listeners[event.type] || []).forEach((fn) => fn(event));
      return true;
    }

    resume = vi.fn(async () => {
      this.state = "running";
    });
  }

  class MockContext {
    public rawContext = new MockAudioContext();
    public state = "running";
    constructor(public options?: any) {}
  }

  const activeContext = { current: new MockContext() };

  return { MockAudioContext, MockContext, activeContext };
});

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
  }

  class MockFreeverb extends MockNode {
    wet = { value: 0.15 };
    roomSize = { value: 0.75 };
    dampening = { value: 3500 };
  }

  class MockFeedbackDelay extends MockNode {
    wet = { value: 0 };
    delayTime = { value: "8n." };
    feedback = { value: 0.3 };
  }

  class MockChorus extends MockNode {
    wet = { value: 0 };
    frequency = { value: 1.5 };
    depth = 0.6;
    delayTime = 3.5;
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
    now: vi.fn(() => 100),
    start: vi.fn().mockResolvedValue(undefined),
    Context: MockContext,
    getContext: vi.fn(() => activeContext.current),
    setContext: vi.fn((ctx) => { activeContext.current = ctx; }),
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

import * as Tone from "tone";
import { SynthEngine } from "../engine/SynthEngine";

describe("SynthEngine v0.2.0 Additions (S1, S2, S3)", () => {
  let engine: SynthEngine;

  beforeEach(async () => {
    activeContext.current = new MockContext();
    engine = new SynthEngine();
    await engine.init();
  });

  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
  });

  describe("S1: Sustained Notes (noteOn / noteOff)", () => {
    it("noteOn with MIDI note number converts to pitch name and triggers attack & MIDI", () => {
      const attackSpy = vi.spyOn(engine.polyVoice, "triggerAttack");
      const midiSpy = vi.spyOn(engine.webMidi, "sendNoteOn");

      // 60 is C4
      engine.noteOn(60, 0.7, { voiceType: "poly", channel: 1 });

      expect(attackSpy).toHaveBeenCalledWith("C4", undefined, 0.7);
      expect(midiSpy).toHaveBeenCalledWith(60, 0.7, 1);
    });

    it("noteOn with pitch string converts to MIDI number and triggers attack & MIDI", () => {
      const attackSpy = vi.spyOn(engine.moogVoice, "triggerAttack");
      const midiSpy = vi.spyOn(engine.webMidi, "sendNoteOn");

      // A4 is 69
      engine.noteOn("A4", 0.9, { voiceType: "moog", channel: 3 });

      expect(attackSpy).toHaveBeenCalledWith("A4", undefined, 0.9);
      expect(midiSpy).toHaveBeenCalledWith(69, 0.9, 3);
    });

    it("noteOn clamps velocity to 0..1 range", () => {
      const attackSpy = vi.spyOn(engine.polyVoice, "triggerAttack");
      const midiSpy = vi.spyOn(engine.webMidi, "sendNoteOn");

      engine.noteOn("C4", 1.5);
      expect(attackSpy).toHaveBeenCalledWith("C4", undefined, 1.0);
      expect(midiSpy).toHaveBeenCalledWith(60, 1.0, 1);

      engine.noteOn("C4", -0.5);
      expect(attackSpy).toHaveBeenCalledWith("C4", undefined, 0.0);
      expect(midiSpy).toHaveBeenCalledWith(60, 0.0, 1);
    });

    it("noteOff with MIDI note number converts to pitch and triggers release & MIDI", () => {
      const releaseSpy = vi.spyOn(engine.polyVoice, "triggerRelease");
      const midiSpy = vi.spyOn(engine.webMidi, "sendNoteOff");

      engine.noteOff(60, { voiceType: "poly", channel: 1 });

      expect(releaseSpy).toHaveBeenCalledWith("C4");
      expect(midiSpy).toHaveBeenCalledWith(60, 1);
    });

    it("noteOff with pitch string triggers release & MIDI", () => {
      const releaseSpy = vi.spyOn(engine.fmVoice, "triggerRelease");
      const midiSpy = vi.spyOn(engine.webMidi, "sendNoteOff");

      engine.noteOff("D3", { voiceType: "fm", channel: 2 });

      expect(releaseSpy).toHaveBeenCalledWith("D3");
      expect(midiSpy).toHaveBeenCalledWith(50, 2);
    });

    it("does nothing when not initialized", () => {
      const freshEngine = new SynthEngine();
      const attackSpy = vi.spyOn(freshEngine.polyVoice, "triggerAttack");
      const releaseSpy = vi.spyOn(freshEngine.polyVoice, "triggerRelease");

      freshEngine.noteOn(60);
      freshEngine.noteOff(60);

      expect(attackSpy).not.toHaveBeenCalled();
      expect(releaseSpy).not.toHaveBeenCalled();
    });
  });

  describe("S2: releaseAll and panic", () => {
    it("releaseAll triggers release across all 7 engine voices", () => {
      const polySpy = vi.spyOn(engine.polyVoice, "triggerRelease");
      const fmSpy = vi.spyOn(engine.fmVoice, "triggerRelease");
      const pluckSpy = vi.spyOn(engine.pluckVoice, "triggerRelease");
      const moogSpy = vi.spyOn(engine.moogVoice, "triggerRelease");
      const droneSpy = vi.spyOn(engine.droneVoice, "triggerRelease");
      const membraneSpy = vi.spyOn(engine.membraneVoice, "triggerRelease");
      const samplerSpy = vi.spyOn(engine.samplerVoice, "triggerRelease");

      engine.releaseAll();

      expect(polySpy).toHaveBeenCalledTimes(1);
      expect(fmSpy).toHaveBeenCalledTimes(1);
      expect(pluckSpy).toHaveBeenCalledTimes(1);
      expect(moogSpy).toHaveBeenCalledTimes(1);
      expect(droneSpy).toHaveBeenCalledTimes(1);
      expect(membraneSpy).toHaveBeenCalledTimes(1);
      expect(samplerSpy).toHaveBeenCalledTimes(1);
    });

    it("panic immediately silences all voices with Tone.now() and sends allNotesOff", () => {
      const releaseAllSpy = vi.spyOn(engine, "releaseAll");
      const midiPanicSpy = vi.spyOn(engine.webMidi, "allNotesOff");

      engine.panic();

      expect(releaseAllSpy).toHaveBeenCalledTimes(1);
      expect(releaseAllSpy).toHaveBeenCalledWith(100);
      expect(midiPanicSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("S3: Audio Lifecycle", () => {
    it("init with latencyHint sets Tone context when not yet running", async () => {
      const freshEngine = new SynthEngine();
      const setContextSpy = vi.spyOn(Tone, "setContext");

      activeContext.current.state = "suspended";
      await freshEngine.init({ latencyHint: "playback" });

      expect(setContextSpy).toHaveBeenCalled();
      freshEngine.dispose();
    });

    it("unlock resumes audio context and resolves true when running", async () => {
      activeContext.current.rawContext.state = "suspended";
      const unlocked = await engine.unlock();
      expect(unlocked).toBe(true);
      expect(activeContext.current.rawContext.resume).toHaveBeenCalled();
    });

    it("resume resumes audio context", async () => {
      activeContext.current.rawContext.state = "suspended";
      await engine.resume();
      expect(activeContext.current.rawContext.resume).toHaveBeenCalled();
    });

    it("getAudioState returns current audio state", () => {
      activeContext.current.rawContext.state = "running";
      expect(engine.getAudioState()).toBe("running");

      activeContext.current.rawContext.state = "suspended";
      expect(engine.getAudioState()).toBe("suspended");
    });

    it("onAudioStateChange subscribes to statechange and unsubscribes cleanly", () => {
      const callback = vi.fn();
      const unsubscribe = engine.onAudioStateChange(callback);

      activeContext.current.rawContext.dispatchEvent({ type: "statechange" });

      expect(callback).toHaveBeenCalledWith(engine.getAudioState());
      callback.mockClear();

      unsubscribe();
      activeContext.current.rawContext.dispatchEvent({ type: "statechange" });
      expect(callback).not.toHaveBeenCalled();
    });

    it("does not attach AudioContext statechange listener during init if no subscribers exist", async () => {
      const freshEngine = new SynthEngine();
      const addEventListenerSpy = vi.spyOn(activeContext.current.rawContext, "addEventListener");

      await freshEngine.init();

      expect(addEventListenerSpy).not.toHaveBeenCalledWith("statechange", expect.any(Function));
      freshEngine.dispose();
    });
  });
});

describe("SynthEngine v0.3.0 init options", () => {
  beforeEach(() => {
    activeContext.current = new MockContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests Web MIDI access by default", async () => {
    const engine = new SynthEngine();
    const midiInitSpy = vi.spyOn(engine.webMidi, "init");
    await engine.init();
    expect(midiInitSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("webMidi: false skips the engine's own Web MIDI access request", async () => {
    const engine = new SynthEngine();
    const midiInitSpy = vi.spyOn(engine.webMidi, "init");
    await engine.init({ webMidi: false });
    expect(midiInitSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("lookAhead sets the Tone context look-ahead", async () => {
    const engine = new SynthEngine();
    (activeContext.current as any).lookAhead = 0.1;
    await engine.init({ lookAhead: 0 });
    expect((activeContext.current as any).lookAhead).toBe(0);
    engine.dispose();
  });

  it("leaves the look-ahead unchanged when omitted or invalid", async () => {
    for (const lookAhead of [undefined, -1, Number.NaN]) {
      activeContext.current = new MockContext();
      (activeContext.current as any).lookAhead = 0.1;
      const engine = new SynthEngine();
      await engine.init({ lookAhead });
      expect((activeContext.current as any).lookAhead).toBe(0.1);
      engine.dispose();
    }
  });

  it("applies lookAhead to the context created for latencyHint", async () => {
    activeContext.current.state = "suspended";
    const engine = new SynthEngine();
    await engine.init({ latencyHint: "interactive", lookAhead: 0 });
    expect(activeContext.current.options).toEqual({ latencyHint: "interactive" });
    expect((activeContext.current as any).lookAhead).toBe(0);
    engine.dispose();
  });

  it("concurrent init calls share one initialization", async () => {
    const engine = new SynthEngine();
    const fxInitSpy = vi.spyOn(engine.fxRack, "init");
    const polyInitSpy = vi.spyOn(engine.polyVoice, "init");
    const first = engine.init();
    const second = engine.init();
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(fxInitSpy).toHaveBeenCalledTimes(1);
    expect(polyInitSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("ignores notes until init succeeds, and a failed init can be retried", async () => {
    const engine = new SynthEngine();
    vi.spyOn(engine.fxRack, "init").mockRejectedValueOnce(new Error("boom"));
    const attackSpy = vi.spyOn(engine.polyVoice, "triggerAttack");

    await expect(engine.init()).rejects.toThrow("boom");
    engine.noteOn(60);
    expect(attackSpy).not.toHaveBeenCalled();

    await engine.init();
    engine.noteOn(60);
    expect(attackSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("can initialize again after dispose", async () => {
    const engine = new SynthEngine();
    await engine.init();
    engine.dispose();
    const polyInitSpy = vi.spyOn(engine.polyVoice, "init");
    await engine.init();
    expect(polyInitSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });
});
