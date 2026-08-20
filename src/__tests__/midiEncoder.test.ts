import { describe, it, expect } from "vitest";
import { MidiFileEncoder } from "../midi/MidiFileEncoder";
import { MidiNoteEvent } from "../types";

describe("MidiFileEncoder", () => {
  it("should generate a valid SMF Type 0 buffer with MThd and MTrk chunks", () => {
    const events: MidiNoteEvent[] = [
      { note: "C4", time: 0, duration: 1.0, velocity: 0.8, channel: 1 },
      { note: "E4", time: 0, duration: 1.0, velocity: 0.8, channel: 1 },
      { note: "G4", time: 0, duration: 1.0, velocity: 0.8, channel: 1 }
    ];

    const buffer = MidiFileEncoder.createStandardMidiFile(events, 120, "Test Song");
    const uint8 = new Uint8Array(buffer);

    // Check "MThd" header chunk
    expect(String.fromCharCode(...uint8.slice(0, 4))).toBe("MThd");
    // Format 0
    expect(uint8[9]).toBe(0);
    // 1 track
    expect(uint8[11]).toBe(1);

    // Check "MTrk" track chunk exists
    const trackChunkIndex = 14;
    expect(String.fromCharCode(...uint8.slice(trackChunkIndex, trackChunkIndex + 4))).toBe("MTrk");
  });
});
