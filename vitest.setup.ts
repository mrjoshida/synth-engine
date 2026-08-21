import { AudioContext, OfflineAudioContext } from "standardized-audio-context-mock";
import * as Tone from "tone";

if (typeof window !== "undefined") {
  (window as any).AudioContext = AudioContext;
  (window as any).OfflineAudioContext = OfflineAudioContext;
  (window as any).webkitAudioContext = AudioContext;
}

if (typeof globalThis !== "undefined") {
  (globalThis as any).AudioContext = AudioContext;
  (globalThis as any).OfflineAudioContext = OfflineAudioContext;
  (globalThis as any).webkitAudioContext = AudioContext;
}

// Reset Tone's context so it uses the mocked AudioContext
try {
  const ctx = new Tone.Context();
  Tone.setContext(ctx);
} catch (e) {
  // context ready
}
