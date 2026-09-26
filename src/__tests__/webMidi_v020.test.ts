import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebMidiManager, parseMidiMessage } from "../midi/WebMidiManager";
import {
  FakeMIDIPort,
  FakeMIDIInput,
  FakeMIDIOutput,
  FakeMidiAccess,
  installFakeMidi
} from "../testing/FakeMidiAccess";

describe("WebMidiManager v0.2.0 Additions (S4 & S5)", () => {
  let restoreMidi: () => void;
  let fakeAccess: FakeMidiAccess;
  let fakeIn1: FakeMIDIInput;
  let fakeOut1: FakeMIDIOutput;
  let fakeOut2: FakeMIDIOutput;

  beforeEach(() => {
    fakeIn1 = new FakeMIDIInput("in-1", "Launchpad X LPX MIDI In", "Novation");
    fakeOut1 = new FakeMIDIOutput("out-1", "Launchpad X LPX MIDI Out", "Novation");
    fakeOut2 = new FakeMIDIOutput("out-2", "External Hardware Synth", "Moog");

    fakeAccess = new FakeMidiAccess({
      inputs: [fakeIn1],
      outputs: [fakeOut1, fakeOut2],
      sysexEnabled: true
    });

    const installed = installFakeMidi(globalThis, { access: fakeAccess });
    restoreMidi = installed.restore;
  });

  afterEach(() => {
    if (restoreMidi) restoreMidi();
    vi.restoreAllMocks();
  });

  describe("S5: Fake MIDI Test Double Basics", () => {
    it("FakeMIDIPort has expected properties", () => {
      const port = new FakeMIDIPort("test-1", "input", "Test Port", "Acme");
      expect(port.id).toBe("test-1");
      expect(port.type).toBe("input");
      expect(port.name).toBe("Test Port");
      expect(port.manufacturer).toBe("Acme");
      expect(port.state).toBe("connected");
      expect(port.connection).toBe("closed");
    });

    it("FakeMIDIInput emits messages to both addEventListener and onmidimessage", () => {
      const listenerSpy = vi.fn();
      const onHandlerSpy = vi.fn();

      fakeIn1.addEventListener("midimessage", listenerSpy);
      fakeIn1.onmidimessage = onHandlerSpy;

      const data = new Uint8Array([0x90, 60, 100]);
      fakeIn1.emit(data, 1234.5);

      expect(listenerSpy).toHaveBeenCalledTimes(1);
      const ev1 = listenerSpy.mock.calls[0][0];
      expect(ev1.data).toEqual(data);
      expect(ev1.timeStamp).toBe(1234.5);

      expect(onHandlerSpy).toHaveBeenCalledTimes(1);
      const ev2 = onHandlerSpy.mock.calls[0][0];
      expect(ev2.data).toEqual(data);
      expect(ev2.timeStamp).toBe(1234.5);

      // Test removeEventListener
      fakeIn1.removeEventListener("midimessage", listenerSpy);
      fakeIn1.emit(data);
      expect(listenerSpy).toHaveBeenCalledTimes(1);
      expect(onHandlerSpy).toHaveBeenCalledTimes(2);
    });

    it("FakeMIDIOutput records sent messages and clearSentMessages clears them", () => {
      fakeOut1.send([0x90, 60, 80], 500);
      fakeOut1.send(new Uint8Array([0x80, 60, 0]));

      expect(fakeOut1.sentMessages).toHaveLength(2);
      expect(fakeOut1.sentMessages[0]).toEqual({
        data: new Uint8Array([0x90, 60, 80]),
        timestamp: 500
      });
      expect(fakeOut1.sentMessages[1]).toEqual({
        data: new Uint8Array([0x80, 60, 0]),
        timestamp: undefined
      });

      fakeOut1.clearSentMessages();
      expect(fakeOut1.sentMessages).toHaveLength(0);
    });

    it("FakeMidiAccess fires statechange events when ports connect and disconnect", () => {
      const stateChangeListener = vi.fn();
      fakeAccess.addEventListener("statechange", stateChangeListener);

      const newPort = new FakeMIDIOutput("out-3", "New Port");
      fakeAccess.connectPort(newPort);

      expect(stateChangeListener).toHaveBeenCalledTimes(1);
      expect(stateChangeListener.mock.calls[0][0].port).toBe(newPort);
      expect(fakeAccess.outputs.get("out-3")).toBe(newPort);

      fakeAccess.disconnectPort("out-3");
      expect(stateChangeListener).toHaveBeenCalledTimes(2);
      expect(fakeAccess.outputs.get("out-3")?.state).toBe("disconnected");
    });
  });

  describe("S4: Parser Table", () => {
    it("parses Note On (0x90 with velocity > 0)", () => {
      const parsed = parseMidiMessage(new Uint8Array([0x90, 60, 100]), 1000, "port-1");
      expect(parsed).toEqual({
        type: "noteon",
        channel: 1,
        note: 60,
        velocity: 100,
        timeStamp: 1000,
        portId: "port-1",
        data: new Uint8Array([0x90, 60, 100]),
        raw: new Uint8Array([0x90, 60, 100])
      });
    });

    it("normalizes Note On with velocity 0 to Note Off", () => {
      const parsed = parseMidiMessage([0x92, 60, 0], 1000);
      expect(parsed).toEqual({
        type: "noteoff",
        channel: 3,
        note: 60,
        velocity: 0,
        timeStamp: 1000,
        portId: "",
        data: new Uint8Array([0x92, 60, 0]),
        raw: new Uint8Array([0x92, 60, 0])
      });
    });

    it("parses Note Off (0x80)", () => {
      const parsed = parseMidiMessage(new Uint8Array([0x81, 64, 40]));
      expect(parsed.type).toBe("noteoff");
      expect(parsed.channel).toBe(2);
      expect(parsed.note).toBe(64);
      expect(parsed.velocity).toBe(40);
    });

    it("parses Control Change (0xB0)", () => {
      const parsed = parseMidiMessage(new Uint8Array([0xB3, 7, 127]));
      expect(parsed.type).toBe("cc");
      expect(parsed.channel).toBe(4);
      expect(parsed.controller).toBe(7);
      expect(parsed.value).toBe(127);
    });

    it("parses Polyphonic Key Pressure / Aftertouch (0xA0)", () => {
      const parsed = parseMidiMessage(new Uint8Array([0xA0, 60, 85]));
      expect(parsed.type).toBe("polyaftertouch");
      expect(parsed.channel).toBe(1);
      expect(parsed.note).toBe(60);
      expect(parsed.value).toBe(85);
    });

    it("parses Channel Pressure / Monophonic Aftertouch (0xD0)", () => {
      const parsed = parseMidiMessage(new Uint8Array([0xD5, 99]));
      expect(parsed.type).toBe("channelpressure");
      expect(parsed.channel).toBe(6);
      expect(parsed.value).toBe(99);
    });

    it("parses System Exclusive (0xF0)", () => {
      const sysexBytes = new Uint8Array([0xF0, 0x00, 0x20, 0x29, 0x02, 0x0C, 0xF7]);
      const parsed = parseMidiMessage(sysexBytes);
      expect(parsed.type).toBe("sysex");
      expect(parsed.channel).toBeUndefined();
      expect(parsed.data).toEqual(sysexBytes);
      expect(parsed.raw).toEqual(sysexBytes);
    });

    it("parses unknown/unsupported messages as other", () => {
      const timingClock = new Uint8Array([0xF8]);
      const parsed = parseMidiMessage(timingClock);
      expect(parsed.type).toBe("other");
      expect(parsed.data).toEqual(timingClock);
      expect(parsed.raw).toEqual(timingClock);

      const empty = parseMidiMessage(new Uint8Array([]));
      expect(empty.type).toBe("other");
    });
  });

  describe("S4: WebMidiManager Integration", () => {
    it("sysex fallback when sysex is denied by host", async () => {
      const deniedAccess = new FakeMidiAccess({
        inputs: [fakeIn1],
        outputs: [fakeOut1, fakeOut2]
      });
      installFakeMidi(globalThis, {
        access: deniedAccess,
        denySysex: true
      });

      const manager = new WebMidiManager();
      const granted = await manager.requestAccess({ sysex: true });

      expect(granted).toBe(true);
      expect(manager.sysexEnabled).toBe(false);
      expect(manager.isAvailable()).toBe(true);
    });

    it("sendSysex is refused without sysex enabled", async () => {
      fakeAccess.sysexEnabled = false;
      const manager = new WebMidiManager();
      await manager.requestAccess({ sysex: false });

      expect(manager.sysexEnabled).toBe(false);

      const result = manager.sendSysex([0xF0, 0x00, 0x20, 0x29, 0xF7], fakeOut1.id);
      expect(result).toBe(false);
      expect(fakeOut1.sentMessages).toHaveLength(0);
      expect(fakeOut2.sentMessages).toHaveLength(0);
    });

    it("sendSysex succeeds when sysex is enabled", async () => {
      const manager = new WebMidiManager();
      await manager.requestAccess({ sysex: true });

      expect(manager.sysexEnabled).toBe(true);

      const sysexPayload = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0C, 0xF7];
      const result = manager.sendSysex(sysexPayload, fakeOut1.id);

      expect(result).toBe(true);
      expect(fakeOut1.sentMessages).toHaveLength(1);
      expect(fakeOut1.sentMessages[0].data).toEqual(new Uint8Array(sysexPayload));
    });

    it("port filter hides filtered ports from getAvailableOutputs but sendTo still works", async () => {
      const manager = new WebMidiManager();
      await manager.init();

      expect(manager.getAvailableOutputs()).toHaveLength(2);

      // Exclude LPX ports
      manager.setPortFilter((p) => !p.name?.includes("LPX"));

      const outputs = manager.getAvailableOutputs();
      expect(outputs).toHaveLength(1);
      expect(outputs[0].id).toBe("out-2");
      expect(outputs[0].name).toBe("External Hardware Synth");

      // Direct addressing via sendTo still works even for filtered port
      manager.sendTo("out-1", [0x90, 60, 100]);
      expect(fakeOut1.sentMessages).toHaveLength(1);
      expect(fakeOut1.sentMessages[0].data).toEqual(new Uint8Array([0x90, 60, 100]));
    });

    it("multiple statechange listeners are both called on port changes", async () => {
      const manager = new WebMidiManager();
      await manager.init();

      const listenerA = vi.fn();
      const listenerB = vi.fn();

      const unsubA = manager.onPortsChanged(listenerA);
      const unsubB = manager.onPortsChanged(listenerB);

      const newOutput = new FakeMIDIOutput("out-99", "Newly Connected Device");
      fakeAccess.connectPort(newOutput);

      expect(listenerA).toHaveBeenCalledTimes(1);
      expect(listenerB).toHaveBeenCalledTimes(1);

      unsubA();
      fakeAccess.disconnectPort("out-99");

      expect(listenerA).toHaveBeenCalledTimes(1); // not called again
      expect(listenerB).toHaveBeenCalledTimes(2); // called again

      unsubB();
    });

    it("allNotesOff sends CC 123 + CC 120 for requested channel(s)", async () => {
      const manager = new WebMidiManager();
      await manager.init();
      manager.selectOutput("out-1");

      // Send to channel 1 and 2 only
      manager.allNotesOff([1, 2]);

      expect(fakeOut1.sentMessages).toHaveLength(4);
      // Channel 1 (status 0xB0)
      expect(fakeOut1.sentMessages[0].data).toEqual(new Uint8Array([0xB0, 123, 0]));
      expect(fakeOut1.sentMessages[1].data).toEqual(new Uint8Array([0xB0, 120, 0]));
      // Channel 2 (status 0xB1)
      expect(fakeOut1.sentMessages[2].data).toEqual(new Uint8Array([0xB1, 123, 0]));
      expect(fakeOut1.sentMessages[3].data).toEqual(new Uint8Array([0xB1, 120, 0]));

      fakeOut1.clearSentMessages();

      // Default sends to all 16 channels (16 * 2 = 32 messages)
      manager.allNotesOff();
      expect(fakeOut1.sentMessages).toHaveLength(32);
    });

    it("enumerates input ports, selects an input, and dispatches onMessage", async () => {
      const manager = new WebMidiManager();
      await manager.init();

      const inputs = manager.getInputs();
      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe("in-1");

      manager.selectInput("in-1");
      expect(manager.getSelectedInputId()).toBe("in-1");

      const messageListener = vi.fn();
      const unsub = manager.onMessage(messageListener);

      fakeIn1.emit(new Uint8Array([0x90, 60, 100]));

      expect(messageListener).toHaveBeenCalledTimes(1);
      expect(messageListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "noteon",
          channel: 1,
          note: 60,
          velocity: 100,
          portId: "in-1"
        })
      );

      unsub();
      fakeIn1.emit(new Uint8Array([0x80, 60, 0]));
      expect(messageListener).toHaveBeenCalledTimes(1);
    });

    it("reattaches midimessage listener when selected input is disconnected and reconnected", async () => {
      const manager = new WebMidiManager();
      await manager.init();

      manager.selectInput("in-1");
      const messageListener = vi.fn();
      manager.onMessage(messageListener);

      fakeIn1.emit(new Uint8Array([0x90, 60, 100]));
      expect(messageListener).toHaveBeenCalledTimes(1);

      fakeAccess.removeInput("in-1");
      expect(manager.getInputs()).toHaveLength(0);

      const reconnectedIn1 = fakeAccess.addInput({
        id: "in-1",
        name: "Launchpad X LPX MIDI In",
        manufacturer: "Novation"
      });
      expect(manager.getInputs()).toHaveLength(1);
      expect(manager.getSelectedInputId()).toBe("in-1");

      reconnectedIn1.emit(new Uint8Array([0x90, 64, 110]));
      expect(messageListener).toHaveBeenCalledTimes(2);
      expect(messageListener).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: "noteon",
          note: 64,
          velocity: 110,
          portId: "in-1"
        })
      );
    });
  });
});
