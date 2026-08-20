import { MidiNoteEvent } from "../types";
import { pitchToMidiNumber } from "@mrjoshida/music-theory";

export class MidiFileEncoder {
  public static createStandardMidiFile(
    events: MidiNoteEvent[],
    bpm: number = 120,
    trackName: string = "Orbis Sequence"
  ): ArrayBuffer {
    const PPQ = 480; // Pulses Per Quarter note
    const secondsPerQuarter = 60 / bpm;

    interface RawMidiAction {
      tick: number;
      type: "on" | "off";
      noteNumber: number;
      velocity: number;
      channel: number;
    }

    const actions: RawMidiAction[] = [];

    events.forEach((ev) => {
      const noteNumber = pitchToMidiNumber(ev.note);
      const startTick = Math.round((ev.time / secondsPerQuarter) * PPQ);
      const endTick = Math.round(((ev.time + ev.duration) / secondsPerQuarter) * PPQ);

      actions.push({
        tick: Math.max(0, startTick),
        type: "on",
        noteNumber,
        velocity: Math.max(1, Math.min(127, Math.round(ev.velocity * 127))),
        channel: Math.max(0, Math.min(15, (ev.channel || 1) - 1))
      });

      actions.push({
        tick: Math.max(0, endTick),
        type: "off",
        noteNumber,
        velocity: 0,
        channel: Math.max(0, Math.min(15, (ev.channel || 1) - 1))
      });
    });

    actions.sort((a, b) => a.tick - b.tick);

    const trackBytes: number[] = [];

    // Track Name Meta Event
    const nameBytes = Array.from(new TextEncoder().encode(trackName));
    trackBytes.push(0x00, 0xff, 0x03, nameBytes.length, ...nameBytes);

    // Set Tempo Meta Event (microsec per quarter)
    const microsecPerQuarter = Math.round(60000000 / bpm);
    trackBytes.push(
      0x00,
      0xff,
      0x51,
      0x03,
      (microsecPerQuarter >> 16) & 0xff,
      (microsecPerQuarter >> 8) & 0xff,
      microsecPerQuarter & 0xff
    );

    let lastTick = 0;
    actions.forEach((act) => {
      const delta = act.tick - lastTick;
      lastTick = act.tick;

      // Variable length delta
      const deltaBytes = MidiFileEncoder.encodeVarLen(delta);
      trackBytes.push(...deltaBytes);

      const status = act.type === "on" ? 0x90 | act.channel : 0x80 | act.channel;
      trackBytes.push(status, act.noteNumber, act.velocity);
    });

    // End of Track Meta Event
    trackBytes.push(0x00, 0xff, 0x2f, 0x00);

    const header = [
      0x4d, 0x54, 0x68, 0x64, // "MThd"
      0x00, 0x00, 0x00, 0x06, // Header length = 6
      0x00, 0x00,             // Format 0 (single track)
      0x00, 0x01,             // 1 Track
      (PPQ >> 8) & 0xff, PPQ & 0xff // PPQ
    ];

    const trackLength = trackBytes.length;
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b, // "MTrk"
      (trackLength >> 24) & 0xff,
      (trackLength >> 16) & 0xff,
      (trackLength >> 8) & 0xff,
      trackLength & 0xff
    ];

    const fullFile = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
    return fullFile.buffer;
  }

  private static encodeVarLen(value: number): number[] {
    let buffer = value & 0x7f;
    const bytes: number[] = [];

    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= (value & 0x7f) | 0x80;
    }

    while (true) {
      bytes.push(buffer & 0xff);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }
    return bytes;
  }
}
