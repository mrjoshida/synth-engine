export type SynthEngineType = "poly" | "fm" | "pluck" | "moog" | "drone" | "membrane" | "sampler";

/** Options for `SynthEngine.init()`. */
export interface SynthEngineInitOptions {
  /** AudioContext latency hint, applied only while audio is not yet running. */
  latencyHint?: AudioContextLatencyCategory | number;
  /**
   * Tone.js scheduling look-ahead in seconds (Tone's default is 0.1). Use `0` for live play.
   * Keep a look-ahead if you schedule sequences on the Transport: without one, main-thread jitter
   * can make scheduled events late or uneven.
   */
  lookAhead?: number;
  /** Pass `false` when the host app manages Web MIDI itself. Defaults to `true`. */
  webMidi?: boolean;
}

export type OscillatorShape = "sine" | "triangle" | "sawtooth" | "square" | "fatsaw" | "fattriangle" | "pulse";

export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterConfig {
  frequency: number;
  type: "lowpass" | "highpass" | "bandpass" | "notch";
  rolloff?: -12 | -24 | -48;
  Q?: number;
}

export interface FxConfig {
  reverbWet: number;
  reverbDecay: number;
  chorusWet: number;
  chorusFrequency: number;
  chorusDepth: number;
  delayWet: number;
  delayTime: string;
  delayFeedback: number;
  drive: number;
  masterVolume: number;
}

export interface SamplerInstrumentConfig {
  id: string;
  name: string;
  baseUrl: string;
  sampleMap: Record<string, string>;
  attackCurve?: "linear" | "exponential";
  releaseCurve?: "linear" | "exponential";
  volume?: number;
}

export interface SynthPatch {
  /** Patch format version, currently 1. */
  schemaVersion?: number;
  id: string;
  name: string;
  category: "pad" | "lead" | "pluck" | "bass" | "drone" | "percussion" | "bell" | "keys";
  engineType: SynthEngineType;
  description?: string;
  oscillator?: {
    type: OscillatorShape;
    count?: number;
    spread?: number;
  };
  envelope: EnvelopeConfig;
  filter?: FilterConfig;
  fmParams?: {
    harmonicity: number;
    modulationIndex: number;
    modulationType: OscillatorShape;
    modulationEnvelope: EnvelopeConfig;
  };
  pluckParams?: {
    dampening: number;
    resonance: number;
    attackNoise: number;
  };
  moogParams?: {
    subOscLevel: number;
    ladderCutoff: number;
    ladderResonance: number;
    drive: number;
  };
  membraneParams?: {
    pitchDecay: number;
    octaves: number;
  };
  fxSends?: Partial<FxConfig>;
  samplerConfig?: {
    instrumentId: string;
  };
}

export interface MidiNoteEvent {
  note: string;
  time: number;
  duration: number;
  velocity: number;
  channel: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer?: string;
  state: "connected" | "disconnected";
}

export type MidiEventType =
  | "noteon"
  | "noteoff"
  | "cc"
  | "polyaftertouch"
  | "channelpressure"
  | "sysex"
  | "other";

export interface ParsedMidiEvent {
  type: MidiEventType;
  channel?: number;
  note?: number;
  controller?: number;
  velocity?: number;
  value?: number;
  data: Uint8Array;
  raw?: Uint8Array;
  timeStamp: number;
  portId: string;
}
