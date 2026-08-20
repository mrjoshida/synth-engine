export type SynthEngineType = "poly" | "fm" | "pluck" | "moog" | "drone" | "membrane" | "sampler";

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
