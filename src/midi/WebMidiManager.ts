import { MidiDevice } from "../types";

export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private availableOutputs: MidiDevice[] = [];
  private listeners: Set<(devices: MidiDevice[]) => void> = new Set();
  private isInitialized = false;

  public async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (typeof window === "undefined" || !("requestMIDIAccess" in navigator)) {
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.refreshOutputs();

      this.midiAccess.onstatechange = () => {
        this.refreshOutputs();
      };

      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn("Web MIDI access not available:", e);
      return false;
    }
  }

  private refreshOutputs(): void {
    if (!this.midiAccess) return;
    const outputs: MidiDevice[] = [];

    this.midiAccess.outputs.forEach((port) => {
      outputs.push({
        id: port.id,
        name: port.name || `MIDI Output ${port.id}`,
        manufacturer: port.manufacturer || undefined,
        state: port.state === "connected" ? "connected" : "disconnected"
      });
    });

    this.availableOutputs = outputs;
    this.notifyListeners();
  }

  public getAvailableOutputs(): MidiDevice[] {
    return this.availableOutputs;
  }

  public selectOutput(id: string | null): void {
    this.selectedOutputId = id;
  }

  public getSelectedOutputId(): string | null {
    return this.selectedOutputId;
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

  public onDevicesChanged(cb: (devices: MidiDevice[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.availableOutputs));
  }
}
