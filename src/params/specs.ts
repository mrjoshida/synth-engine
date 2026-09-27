/**
 * @file Parameter specifications and validation for synthesizer engines.
 */

import { SynthEngineType } from "../types";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";

export type ParamValue = number | string;

export type ParamGroup =
  | "voice"
  | "oscillator"
  | "envelope"
  | "filter"
  | "fm"
  | "pluck"
  | "moog"
  | "membrane"
  | "effects"
  | "output";

export interface ParamSpec {
  /** Dot path into SynthPatch. */
  readonly path: string;
  /** Human-readable parameter label. */
  readonly label: string;
  /** UI parameter group. */
  readonly group: ParamGroup;
  /** Engines whose voice applies this parameter. */
  readonly engines: readonly SynthEngineType[];
  /** Value kind: numeric or choice. */
  readonly kind: "number" | "choice";
  /** Minimum value for numeric parameters. */
  readonly min?: number;
  /** Maximum value for numeric parameters. */
  readonly max?: number;
  /** Step increment for numeric parameters. */
  readonly step?: number;
  /** Scale type for numeric sliders. */
  readonly scale?: "linear" | "log";
  /** Parameter display unit. */
  readonly unit?: "s" | "Hz" | "cents" | "%" | "x" | "voices" | "oct" | "dB/oct";
  /** Allowed options for choice parameters. */
  readonly choices?: readonly ParamValue[];
  /** Default value. */
  readonly default: ParamValue;
  /** Engine-specific default value overrides. */
  readonly engineDefaults?: Readonly<Partial<Record<SynthEngineType, ParamValue>>>;
}

const ALL_ENGINES: readonly SynthEngineType[] = Object.freeze([
  "poly",
  "fm",
  "pluck",
  "moog",
  "drone",
  "membrane",
  "sampler",
]);

const ENG_OSC: readonly SynthEngineType[] = Object.freeze(["poly", "fm", "moog", "drone"]);
const ENG_ENV: readonly SynthEngineType[] = Object.freeze(["poly", "fm", "moog", "drone", "membrane"]);

const INSTRUMENT_KEYS = Object.freeze(Object.keys(BUILTIN_INSTRUMENTS));

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Complete list of parameter specifications in UI display order.
 */
export const PARAM_SPECS: readonly ParamSpec[] = deepFreeze([
  {
    path: "engineType",
    label: "Voice",
    group: "voice",
    engines: ALL_ENGINES,
    kind: "choice",
    choices: ["poly", "fm", "pluck", "moog", "drone", "membrane"],
    default: "poly",
  },
  {
    path: "samplerConfig.instrumentId",
    label: "Instrument",
    group: "voice",
    engines: ["sampler"],
    kind: "choice",
    choices: INSTRUMENT_KEYS,
    default: INSTRUMENT_KEYS[0] ?? "grand-piano",
  },
  {
    path: "oscillator.type",
    label: "Waveform",
    group: "oscillator",
    engines: ENG_OSC,
    kind: "choice",
    choices: ["sine", "triangle", "sawtooth", "square", "pulse", "fatsaw", "fattriangle"],
    default: "sawtooth",
    engineDefaults: {
      fm: "sine",
      drone: "triangle",
    },
  },
  {
    path: "oscillator.count",
    label: "Unison voices",
    group: "oscillator",
    engines: ENG_OSC,
    kind: "number",
    min: 1,
    max: 8,
    step: 1,
    scale: "linear",
    unit: "voices",
    default: 1,
  },
  {
    path: "oscillator.spread",
    label: "Unison detune",
    group: "oscillator",
    engines: ENG_OSC,
    kind: "number",
    min: 0,
    max: 100,
    step: 1,
    scale: "linear",
    unit: "cents",
    default: 20,
  },
  {
    path: "envelope.attack",
    label: "Attack",
    group: "envelope",
    engines: ENG_ENV,
    kind: "number",
    min: 0.001,
    max: 10,
    step: 0.001,
    scale: "log",
    unit: "s",
    default: 0.08,
    engineDefaults: {
      fm: 0.002,
      moog: 0.015,
      drone: 1.8,
      membrane: 0.001,
    },
  },
  {
    path: "envelope.decay",
    label: "Decay",
    group: "envelope",
    engines: ENG_ENV,
    kind: "number",
    min: 0.001,
    max: 10,
    step: 0.001,
    scale: "log",
    unit: "s",
    default: 0.4,
    engineDefaults: {
      fm: 0.8,
      moog: 0.35,
      drone: 1.2,
      membrane: 0.4,
    },
  },
  {
    path: "envelope.sustain",
    label: "Sustain",
    group: "envelope",
    engines: ENG_ENV,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.3,
    engineDefaults: {
      fm: 0.1,
      moog: 0.4,
      drone: 0.85,
      membrane: 0.01,
    },
  },
  {
    path: "envelope.release",
    label: "Release",
    group: "envelope",
    engines: ENG_ENV,
    kind: "number",
    min: 0.01,
    max: 20,
    step: 0.01,
    scale: "log",
    unit: "s",
    default: 1.4,
    engineDefaults: {
      fm: 1.2,
      moog: 0.6,
      drone: 3.5,
      membrane: 0.8,
    },
  },
  {
    path: "filter.frequency",
    label: "Cutoff",
    group: "filter",
    engines: ["poly", "fm", "moog"],
    kind: "number",
    min: 20,
    max: 20000,
    step: 1,
    scale: "log",
    unit: "Hz",
    default: 4500,
    engineDefaults: {
      fm: 8000,
    },
  },
  {
    path: "filter.Q",
    label: "Resonance",
    group: "filter",
    engines: ["poly", "fm", "moog"],
    kind: "number",
    min: 0.1,
    max: 20,
    step: 0.1,
    scale: "linear",
    default: 1.5,
    engineDefaults: {
      moog: 4.5,
    },
  },
  {
    path: "filter.type",
    label: "Filter type",
    group: "filter",
    engines: ["poly", "fm"],
    kind: "choice",
    choices: ["lowpass", "highpass", "bandpass", "notch"],
    default: "lowpass",
  },
  {
    path: "filter.rolloff",
    label: "Slope",
    group: "filter",
    engines: ["poly", "fm"],
    kind: "choice",
    choices: [-12, -24, -48],
    unit: "dB/oct",
    default: -24,
    engineDefaults: {
      fm: -12,
    },
  },
  {
    path: "fmParams.harmonicity",
    label: "Harmonicity",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0.1,
    max: 16,
    step: 0.01,
    scale: "log",
    unit: "x",
    default: 3,
    engineDefaults: {
      fm: 3.5,
    },
  },
  {
    path: "fmParams.modulationIndex",
    label: "Mod index",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0,
    max: 100,
    step: 0.1,
    scale: "linear",
    default: 10,
    engineDefaults: {
      fm: 12,
    },
  },
  {
    path: "fmParams.modulationType",
    label: "Mod waveform",
    group: "fm",
    engines: ["fm"],
    kind: "choice",
    choices: ["sine", "triangle", "sawtooth", "square"],
    default: "square",
    engineDefaults: {
      fm: "triangle",
    },
  },
  {
    path: "fmParams.modulationEnvelope.attack",
    label: "Mod attack",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0.001,
    max: 10,
    step: 0.001,
    scale: "log",
    unit: "s",
    default: 0.5,
    engineDefaults: {
      fm: 0.005,
    },
  },
  {
    path: "fmParams.modulationEnvelope.decay",
    label: "Mod decay",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0.001,
    max: 10,
    step: 0.001,
    scale: "log",
    unit: "s",
    default: 0.01,
    engineDefaults: {
      fm: 0.5,
    },
  },
  {
    path: "fmParams.modulationEnvelope.sustain",
    label: "Mod sustain",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 1,
    engineDefaults: {
      fm: 0.05,
    },
  },
  {
    path: "fmParams.modulationEnvelope.release",
    label: "Mod release",
    group: "fm",
    engines: ["fm"],
    kind: "number",
    min: 0.01,
    max: 20,
    step: 0.01,
    scale: "log",
    unit: "s",
    default: 0.5,
    engineDefaults: {
      fm: 0.8,
    },
  },
  {
    path: "pluckParams.dampening",
    label: "Damping",
    group: "pluck",
    engines: ["pluck"],
    kind: "number",
    min: 100,
    max: 12000,
    step: 1,
    scale: "log",
    unit: "Hz",
    default: 4000,
    engineDefaults: {
      pluck: 4200,
    },
  },
  {
    path: "pluckParams.resonance",
    label: "String sustain",
    group: "pluck",
    engines: ["pluck"],
    kind: "number",
    min: 0,
    max: 0.99,
    step: 0.001,
    scale: "linear",
    unit: "%",
    default: 0.7,
    engineDefaults: {
      pluck: 0.95,
    },
  },
  {
    path: "pluckParams.attackNoise",
    label: "Pick noise",
    group: "pluck",
    engines: ["pluck"],
    kind: "number",
    min: 0.1,
    max: 20,
    step: 0.1,
    scale: "log",
    unit: "x",
    default: 1,
    engineDefaults: {
      pluck: 1.2,
    },
  },
  {
    path: "moogParams.drive",
    label: "Drive",
    group: "moog",
    engines: ["moog"],
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.4,
  },
  {
    path: "membraneParams.pitchDecay",
    label: "Pitch decay",
    group: "membrane",
    engines: ["membrane"],
    kind: "number",
    min: 0.001,
    max: 0.5,
    step: 0.001,
    scale: "log",
    unit: "s",
    default: 0.05,
  },
  {
    path: "membraneParams.octaves",
    label: "Pitch sweep",
    group: "membrane",
    engines: ["membrane"],
    kind: "number",
    min: 0.5,
    max: 12,
    step: 0.1,
    scale: "linear",
    unit: "oct",
    default: 4,
    engineDefaults: {
      membrane: 5,
    },
  },
  {
    path: "fxSends.reverbWet",
    label: "Reverb mix",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.15,
  },
  {
    path: "fxSends.reverbDecay",
    label: "Reverb size",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0.05,
    max: 5,
    step: 0.05,
    scale: "linear",
    default: 3.75,
  },
  {
    path: "fxSends.chorusWet",
    label: "Chorus mix",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0,
  },
  {
    path: "fxSends.chorusFrequency",
    label: "Chorus rate",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0.1,
    max: 10,
    step: 0.01,
    scale: "log",
    unit: "Hz",
    default: 1.5,
  },
  {
    path: "fxSends.chorusDepth",
    label: "Chorus depth",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.6,
  },
  {
    path: "fxSends.delayWet",
    label: "Delay mix",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0,
  },
  {
    path: "fxSends.delayTime",
    label: "Delay time",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "choice",
    choices: ["32n", "16n", "16n.", "16t", "8n", "8n.", "8t", "4n", "4n.", "4t", "2n", "2n.", "1m"],
    default: "8n.",
  },
  {
    path: "fxSends.delayFeedback",
    label: "Delay feedback",
    group: "effects",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 0.95,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.3,
  },
  {
    path: "fxSends.masterVolume",
    label: "Volume",
    group: "output",
    engines: ALL_ENGINES,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    scale: "linear",
    unit: "%",
    default: 0.85,
  },
]);

const SPEC_MAP = new Map<string, ParamSpec>(PARAM_SPECS.map((s) => [s.path, s]));

/**
 * Returns the specification for a parameter dot-path, or undefined if unknown.
 * @param path Dot path into SynthPatch.
 */
export function getParamSpec(path: string): ParamSpec | undefined {
  return SPEC_MAP.get(path);
}

/**
 * Returns all parameter specifications applicable to a given synth engine in UI order.
 * @param engine The synth engine type.
 */
export function getParamSpecs(engine: SynthEngineType): ParamSpec[] {
  return PARAM_SPECS.filter((s) => s.engines.includes(engine));
}

/**
 * Gets the default value of a parameter for a given synth engine.
 * Returns spec.engineDefaults?.[engine] ?? spec.default, or undefined if the path is unknown.
 * @param path Dot path into SynthPatch.
 * @param engine The synth engine type.
 */
export function getDefaultParam(path: string, engine?: SynthEngineType): ParamValue | undefined {
  const spec = getParamSpec(path);
  if (!spec) return undefined;
  if (engine && spec.engineDefaults && Object.prototype.hasOwnProperty.call(spec.engineDefaults, engine)) {
    return spec.engineDefaults[engine];
  }
  return spec.default;
}

/**
 * Clamps or validates a raw value against a parameter specification.
 * - For "number": checks finite number, clamps to [min, max], rounds to integer if step is integer >= 1.
 * - For "choice": checks strict equality against choices.
 * Returns the clamped/validated value, or undefined if invalid.
 * @param spec The parameter specification.
 * @param value The value to validate/clamp.
 */
export function clampParam(spec: ParamSpec, value: unknown): ParamValue | undefined {
  if (spec.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    let clamped = value;
    if (spec.min !== undefined && clamped < spec.min) {
      clamped = spec.min;
    }
    if (spec.max !== undefined && clamped > spec.max) {
      clamped = spec.max;
    }
    if (spec.step !== undefined && Number.isInteger(spec.step) && spec.step >= 1) {
      clamped = Math.round(clamped);
    }
    return clamped;
  }

  if (spec.kind === "choice") {
    if (spec.choices && spec.choices.includes(value as ParamValue)) {
      return value as ParamValue;
    }
    return undefined;
  }

  return undefined;
}
