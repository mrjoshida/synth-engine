import { MidiDevice, ParsedMidiEvent } from "../types";

export function parseMidiMessage(
  data: Uint8Array | number[],
  timeStamp: number = 0,
  portId: string = ""
): ParsedMidiEvent {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data ?? []);
  if (!bytes || bytes.length === 0) {
    return { type: "other", data: bytes, raw: bytes, timeStamp, portId };
  }

  const status = bytes[0];

  if (status === 0xF0) {
    return { type: "sysex", data: bytes, raw: bytes, timeStamp, portId };
  }

  if (status >= 0xF1 && status <= 0xFF) {
    return { type: "other", data: bytes, raw: bytes, timeStamp, portId };
  }

  const channel = (status & 0x0F) + 1;
  const msgType = status & 0xF0;

  switch (msgType) {
    case 0x90: {
      const note = bytes.length > 1 ? bytes[1] : 0;
      const velocity = bytes.length > 2 ? bytes[2] : 0;
      if (velocity === 0) {
        return { type: "noteoff", channel, note, velocity: 0, data: bytes, raw: bytes, timeStamp, portId };
      }
      return { type: "noteon", channel, note, velocity, data: bytes, raw: bytes, timeStamp, portId };
    }
    case 0x80: {
      const note = bytes.length > 1 ? bytes[1] : 0;
      const velocity = bytes.length > 2 ? bytes[2] : 0;
      return { type: "noteoff", channel, note, velocity, data: bytes, raw: bytes, timeStamp, portId };
    }
    case 0xB0: {
      const controller = bytes.length > 1 ? bytes[1] : 0;
      const value = bytes.length > 2 ? bytes[2] : 0;
      return { type: "cc", channel, controller, value, data: bytes, raw: bytes, timeStamp, portId };
    }
    case 0xA0: {
      const note = bytes.length > 1 ? bytes[1] : 0;
      const value = bytes.length > 2 ? bytes[2] : 0;
      return { type: "polyaftertouch", channel, note, value, data: bytes, raw: bytes, timeStamp, portId };
    }
    case 0xD0: {
      const value = bytes.length > 1 ? bytes[1] : 0;
      return { type: "channelpressure", channel, value, data: bytes, raw: bytes, timeStamp, portId };
    }
    default:
      return { type: "other", channel, data: bytes, raw: bytes, timeStamp, portId };
  }
}

export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private selectedInputId: string | null = null;
  private availableOutputs: MidiDevice[] = [];
  private availableInputs: MidiDevice[] = [];
  private rawOutputs: MidiDevice[] = [];
  private rawInputs: MidiDevice[] = [];
  private listeners: Set<(devices: MidiDevice[]) => void> = new Set();
  private portListeners: Set<(info?: { inputs: MidiDevice[]; outputs: MidiDevice[] }) => void> = new Set();
  private messageListeners: Set<(event: ParsedMidiEvent) => void> = new Set();
  private attachedInputHandlers: Map<string, (e: any) => void> = new Map();
  private attachedInputPorts: Map<string, MIDIInput> = new Map();
  private portFilter: ((device: MidiDevice) => boolean) | null = null;
  public sysexEnabled = false;
  private isInitialized = false;
  private attachedMidiAccess: MIDIAccess | null = null;
  private handleStateChange = (): void => {
    this.refreshPorts();
  };

  public async init(opts?: { sysex?: boolean }): Promise<boolean> {
    if (this.isInitialized && (opts?.sysex === undefined || opts.sysex === this.sysexEnabled)) {
      return true;
    }
    return this.requestAccess(opts);
  }

  public async requestAccess(opts?: { sysex?: boolean }): Promise<boolean> {
    const nav = typeof navigator !== "undefined" ? navigator : (typeof window !== "undefined" ? (window as any).navigator : undefined);
    if (!nav || typeof nav.requestMIDIAccess !== "function") {
      return false;
    }

    const wantSysex = opts?.sysex ?? false;
    let newAccess: MIDIAccess;
    if (wantSysex) {
      try {
        newAccess = await nav.requestMIDIAccess({ sysex: true });
        this.sysexEnabled = true;
      } catch (err) {
        // Fall back to sysex: false if rejected
        try {
          newAccess = await nav.requestMIDIAccess({ sysex: false });
          this.sysexEnabled = false;
        } catch (fallbackErr) {
          console.warn("Web MIDI access not available:", fallbackErr);
          return false;
        }
      }
    } else {
      try {
        newAccess = await nav.requestMIDIAccess({ sysex: false });
        this.sysexEnabled = false;
      } catch (err) {
        console.warn("Web MIDI access not available:", err);
        return false;
      }
    }

    this.setupMidiAccess(newAccess);
    this.isInitialized = true;
    return true;
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.midiAccess !== null;
  }

  private setupMidiAccess(newAccess?: MIDIAccess): void {
    const accessToAttach = newAccess ?? this.midiAccess;

    // Remove listener from the previously attached MIDIAccess (if any)
    if (this.attachedMidiAccess && this.attachedMidiAccess !== accessToAttach) {
      if (typeof this.attachedMidiAccess.removeEventListener === "function") {
        this.attachedMidiAccess.removeEventListener("statechange", this.handleStateChange);
      } else if ((this.attachedMidiAccess as any).onstatechange === this.handleStateChange) {
        (this.attachedMidiAccess as any).onstatechange = null;
      }
    }

    this.midiAccess = accessToAttach;
    if (!this.midiAccess) {
      this.attachedMidiAccess = null;
      return;
    }

    // Remove before adding to avoid duplicate listeners on the same instance
    if (typeof this.midiAccess.removeEventListener === "function") {
      this.midiAccess.removeEventListener("statechange", this.handleStateChange);
    } else if ((this.midiAccess as any).onstatechange === this.handleStateChange) {
      (this.midiAccess as any).onstatechange = null;
    }

    this.refreshPorts();

    if (typeof this.midiAccess.addEventListener === "function") {
      this.midiAccess.addEventListener("statechange", this.handleStateChange);
    } else {
      (this.midiAccess as any).onstatechange = this.handleStateChange;
    }
    this.attachedMidiAccess = this.midiAccess;
  }

  private refreshPorts(): void {
    if (!this.midiAccess) return;

    for (const [id] of this.attachedInputHandlers) {
      const port = this.midiAccess.inputs.get(id);
      if (!port || port.state === "disconnected") {
        this.detachInputListener(id);
      }
    }

    const rawOutputs: MidiDevice[] = [];
    this.midiAccess.outputs.forEach((port) => {
      rawOutputs.push({
        id: port.id,
        name: port.name || `MIDI Output ${port.id}`,
        manufacturer: port.manufacturer || undefined,
        state: port.state === "connected" ? "connected" : "disconnected"
      });
    });

    const rawInputs: MidiDevice[] = [];
    this.midiAccess.inputs.forEach((port) => {
      rawInputs.push({
        id: port.id,
        name: port.name || `MIDI Input ${port.id}`,
        manufacturer: port.manufacturer || undefined,
        state: port.state === "connected" ? "connected" : "disconnected"
      });
    });

    this.rawOutputs = rawOutputs;
    this.rawInputs = rawInputs;

    this.applyPortFilter();
    this.syncInputListeners();
    this.notifyPortListeners();
    this.notifyListeners();
  }

  private applyPortFilter(): void {
    if (this.portFilter) {
      this.availableOutputs = this.rawOutputs.filter(this.portFilter);
    } else {
      this.availableOutputs = [...this.rawOutputs];
    }
    this.availableInputs = [...this.rawInputs];
  }

  public setPortFilter(predicate: ((device: MidiDevice) => boolean) | null): void {
    this.portFilter = predicate;
    this.applyPortFilter();
    this.notifyPortListeners();
    this.notifyListeners();
  }

  public getAvailableOutputs(): MidiDevice[] {
    return this.availableOutputs;
  }

  public getInputs(): MidiDevice[] {
    return this.availableInputs;
  }

  public selectOutput(id: string | null): void {
    this.selectedOutputId = id;
  }

  public getSelectedOutputId(): string | null {
    return this.selectedOutputId;
  }

  public selectInput(id: string | null): void {
    if (this.selectedInputId === id) return;
    this.detachInputListener(this.selectedInputId);
    this.selectedInputId = id;
    this.attachInputListener(id);
  }

  public getSelectedInputId(): string | null {
    return this.selectedInputId;
  }

  public onMessage(cb: (event: ParsedMidiEvent) => void): () => void {
    this.messageListeners.add(cb);
    return () => {
      this.messageListeners.delete(cb);
    };
  }

  private handleIncomingMidi(portId: string, event: any): void {
    const rawData = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
    const timeStamp = event.timeStamp ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
    const parsed = parseMidiMessage(rawData, timeStamp, portId);
    this.messageListeners.forEach((listener) => {
      try {
        listener(parsed);
      } catch (err) {
        console.error("Error in onMessage listener:", err);
      }
    });
  }

  private attachInputListener(id: string | null): void {
    if (!id || !this.midiAccess) return;
    const input = this.midiAccess.inputs.get(id);
    if (!input || input.state === "disconnected") return;

    const currentPort = this.attachedInputPorts.get(id);
    if (currentPort && currentPort !== input) {
      this.detachInputListener(id);
    }

    if (!this.attachedInputHandlers.has(id)) {
      const handler = (e: any) => this.handleIncomingMidi(id, e);
      this.attachedInputHandlers.set(id, handler);
      this.attachedInputPorts.set(id, input);
      if (typeof input.addEventListener === "function") {
        input.addEventListener("midimessage", handler);
      } else {
        (input as any).onmidimessage = handler;
      }
    }
  }

  private detachInputListener(id: string | null): void {
    if (!id) return;
    const input = this.attachedInputPorts.get(id) ?? this.midiAccess?.inputs.get(id);
    const handler = this.attachedInputHandlers.get(id);
    if (input && handler) {
      if (typeof input.removeEventListener === "function") {
        input.removeEventListener("midimessage", handler);
      } else if ((input as any).onmidimessage === handler) {
        (input as any).onmidimessage = null;
      }
    }
    this.attachedInputHandlers.delete(id);
    this.attachedInputPorts.delete(id);
  }

  private syncInputListeners(): void {
    if (this.selectedInputId) {
      this.attachInputListener(this.selectedInputId);
    }
  }

  public sendTo(portId: string, bytes: number[] | Uint8Array): boolean {
    if (!this.midiAccess) return false;
    const output = this.midiAccess.outputs.get(portId);
    if (!output) return false;
    try {
      output.send(bytes as any);
      return true;
    } catch (e) {
      console.warn(`Failed to send to MIDI port ${portId}:`, e);
      return false;
    }
  }

  public sendSysex(bytes: number[] | Uint8Array, portId?: string): boolean {
    if (!this.sysexEnabled || !this.midiAccess) return false;
    const targetId = portId ?? this.selectedOutputId;
    if (!targetId) return false;
    return this.sendTo(targetId, bytes);
  }

  public allNotesOff(channels?: number | number[], portId?: string): void {
    if (!this.midiAccess) return;
    const targetId = portId ?? this.selectedOutputId;
    if (!targetId) return;
    const output = this.midiAccess.outputs.get(targetId);
    if (!output) return;

    let chList: number[];
    if (channels === undefined) {
      chList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    } else if (Array.isArray(channels)) {
      chList = channels;
    } else {
      chList = [channels];
    }

    for (const ch of chList) {
      const clampedChannel = Math.max(1, Math.min(16, ch)) - 1;
      const statusByte = 0xB0 | clampedChannel;
      try {
        // CC 123: All Notes Off
        output.send([statusByte, 123, 0]);
        // CC 120: All Sound Off
        output.send([statusByte, 120, 0]);
      } catch (e) {
        console.warn("Error sending allNotesOff:", e);
      }
    }
  }

  public sendNoteOn(midiNumber: number, velocity: number = 0.8, channel: number = 1): void {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    const clampedChannel = Math.max(1, Math.min(16, channel)) - 1;
    const statusByte = 0x90 | clampedChannel;
    const velByte = Math.max(0, Math.min(127, Math.round(velocity * 127)));
    const noteByte = Math.max(0, Math.min(127, midiNumber));

    output.send([statusByte, noteByte, velByte]);
  }

  public sendNoteOff(midiNumber: number, channel: number = 1): void {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    const clampedChannel = Math.max(1, Math.min(16, channel)) - 1;
    const statusByte = 0x80 | clampedChannel;
    const noteByte = Math.max(0, Math.min(127, midiNumber));

    output.send([statusByte, noteByte, 0]);
  }

  public onPortsChanged(cb: (info?: { inputs: MidiDevice[]; outputs: MidiDevice[] }) => void): () => void {
    this.portListeners.add(cb);
    return () => this.portListeners.delete(cb);
  }

  public onDevicesChanged(cb: (devices: MidiDevice[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyPortListeners(): void {
    const info = { inputs: this.getInputs(), outputs: this.getAvailableOutputs() };
    this.portListeners.forEach((l) => {
      try {
        l(info);
      } catch (e) {
        console.error("Error in onPortsChanged listener:", e);
      }
    });
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => {
      try {
        l(this.availableOutputs);
      } catch (e) {
        console.error("Error in onDevicesChanged listener:", e);
      }
    });
  }
}
