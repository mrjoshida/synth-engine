/**
 * @file Patch management, cloning, parameter get/set, and defaults.
 */

import { FxConfig, SynthEngineType, SynthPatch } from "../types";
import { clampParam, getDefaultParam, getParamSpec, ParamValue } from "./specs";

/**
 * Patch format version.
 */
export const PATCH_SCHEMA_VERSION = 1;

/**
 * Standard baseline FX send settings.
 */
export const FX_BASELINE: Readonly<Omit<FxConfig, "drive">> = Object.freeze({
  reverbWet: 0.15,
  reverbDecay: 3.75,
  chorusWet: 0,
  chorusFrequency: 1.5,
  chorusDepth: 0.6,
  delayWet: 0,
  delayTime: "8n.",
  delayFeedback: 0.3,
  masterVolume: 0.85,
});

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
 * Default initial patch.
 */
export const INIT_PATCH: Readonly<SynthPatch> = deepFreeze({
  schemaVersion: PATCH_SCHEMA_VERSION,
  id: "init",
  name: "Init",
  category: "keys",
  engineType: "poly",
  oscillator: {
    type: "sawtooth",
  },
  envelope: {
    attack: 0.08,
    decay: 0.4,
    sustain: 0.3,
    release: 1.4,
  },
  filter: {
    frequency: 4500,
    type: "lowpass",
    rolloff: -24,
    Q: 1.5,
  },
  fxSends: { ...FX_BASELINE },
});

/**
 * Helper to get a required parameter default or throw if spec path is unknown.
 */
function reqDefault(path: string, engine?: SynthEngineType): any {
  const val = getDefaultParam(path, engine);
  if (val === undefined) {
    throw new Error(`Unknown spec path for default: ${path}`);
  }
  return val;
}

/**
 * Creates a patch section with required fields initialized from engine defaults.
 * Optional fields (oscillator.count/spread, filter.Q/rolloff, fxSends keys) remain absent.
 * @param key Section name.
 * @param engine Target synth engine type.
 */
export function createSection(key: string, engine: SynthEngineType): any {
  switch (key) {
    case "envelope":
      return {
        attack: reqDefault("envelope.attack", engine),
        decay: reqDefault("envelope.decay", engine),
        sustain: reqDefault("envelope.sustain", engine),
        release: reqDefault("envelope.release", engine),
      };
    case "oscillator":
      return {
        type: reqDefault("oscillator.type", engine),
      };
    case "filter":
      return {
        frequency: reqDefault("filter.frequency", engine),
        type: reqDefault("filter.type", engine),
      };
    case "fmParams":
      return {
        harmonicity: reqDefault("fmParams.harmonicity", engine),
        modulationIndex: reqDefault("fmParams.modulationIndex", engine),
        modulationType: reqDefault("fmParams.modulationType", engine),
        modulationEnvelope: {
          attack: reqDefault("fmParams.modulationEnvelope.attack", engine),
          decay: reqDefault("fmParams.modulationEnvelope.decay", engine),
          sustain: reqDefault("fmParams.modulationEnvelope.sustain", engine),
          release: reqDefault("fmParams.modulationEnvelope.release", engine),
        },
      };
    case "pluckParams":
      return {
        dampening: reqDefault("pluckParams.dampening", engine),
        resonance: reqDefault("pluckParams.resonance", engine),
        attackNoise: reqDefault("pluckParams.attackNoise", engine),
      };
    case "moogParams":
      return {
        subOscLevel: 0,
        ladderCutoff: 20000,
        ladderResonance: 0,
        drive: reqDefault("moogParams.drive", engine),
      };
    case "membraneParams":
      return {
        pitchDecay: reqDefault("membraneParams.pitchDecay", engine),
        octaves: reqDefault("membraneParams.octaves", engine),
      };
    case "samplerConfig":
      return {
        instrumentId: reqDefault("samplerConfig.instrumentId", engine),
      };
    case "fxSends":
      return {};
    default:
      return {};
  }
}

/**
 * Creates a deep copy of a SynthPatch using JSON serialization.
 * @param patch The patch to clone.
 */
export function clonePatch(patch: SynthPatch): SynthPatch {
  return JSON.parse(JSON.stringify(patch));
}

/**
 * Gets a raw parameter value by dot-path from a patch, or undefined if not set.
 * Walks own properties only to prevent prototype pollution or inherited property access.
 * @param patch The patch to query.
 * @param path Dot path into SynthPatch.
 */
export function getPatchParam(patch: SynthPatch, path: string): ParamValue | undefined {
  const parts = path.split(".");
  let curr: unknown = patch;
  for (const part of parts) {
    if (curr === null || typeof curr !== "object" || !Object.prototype.hasOwnProperty.call(curr, part)) {
      return undefined;
    }
    curr = (curr as Record<string, unknown>)[part];
  }
  if (typeof curr === "number" || typeof curr === "string") {
    return curr;
  }
  return undefined;
}

/**
 * Gets the effective parameter value:
 * 1. Raw value if present on the patch.
 * 2. FX_BASELINE for fxSends.* if absent on patch.
 * 3. getDefaultParam(path, patch.engineType).
 * Returns undefined for unknown paths.
 * @param patch The patch to query.
 * @param path Dot path into SynthPatch.
 */
export function getEffectiveParam(patch: SynthPatch, path: string): ParamValue | undefined {
  const spec = getParamSpec(path);
  if (!spec) return undefined;

  const raw = getPatchParam(patch, path);
  if (raw !== undefined) {
    return raw;
  }

  if (path.startsWith("fxSends.")) {
    const fxKey = path.slice("fxSends.".length) as keyof typeof FX_BASELINE;
    if (fxKey in FX_BASELINE) {
      return FX_BASELINE[fxKey];
    }
  }

  return getDefaultParam(path, patch.engineType);
}

/**
 * Sets a parameter value in a patch, returning a new patch.
 * - Returns null if the path is unknown or value cannot be clamped by clampParam.
 * - Missing parent sections are populated with createSection(key, patch.engineType).
 * - Always returns a new patch with schemaVersion: 1 (input never mutated).
 * - "engineType" delegates to withEngineType(patch, value).
 * @param patch The original patch.
 * @param path Dot path into SynthPatch.
 * @param value The new value to set.
 */
export function setPatchParam(patch: SynthPatch, path: string, value: unknown): SynthPatch | null {
  const spec = getParamSpec(path);
  if (!spec) return null;

  const clamped = clampParam(spec, value);
  if (clamped === undefined) return null;

  if (path === "engineType") {
    return withEngineType(patch, clamped as SynthEngineType);
  }

  const next = clonePatch(patch);
  next.schemaVersion = PATCH_SCHEMA_VERSION;

  const parts = path.split(".");
  const topKey = parts[0];

  const obj = next as unknown as Record<string, unknown>;
  if (parts.length > 1 && (!obj[topKey] || typeof obj[topKey] !== "object")) {
    obj[topKey] = createSection(topKey, next.engineType);
  }

  let curr: any = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (curr[part] === undefined || curr[part] === null || typeof curr[part] !== "object") {
      curr[part] = {};
    }
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = clamped;

  return next;
}

/**
 * Returns a new patch with the given engineType.
 * Keeps every existing section; adds the engine's own section from defaults if absent.
 * Always sets schemaVersion: 1.
 * @param patch The base patch.
 * @param engine The new engine type.
 */
export function withEngineType(patch: SynthPatch, engine: SynthEngineType): SynthPatch {
  const next = clonePatch(patch);
  next.engineType = engine;
  next.schemaVersion = PATCH_SCHEMA_VERSION;

  if (engine === "fm" && !next.fmParams) {
    next.fmParams = createSection("fmParams", engine);
  } else if (engine === "pluck" && !next.pluckParams) {
    next.pluckParams = createSection("pluckParams", engine);
  } else if (engine === "moog" && !next.moogParams) {
    next.moogParams = createSection("moogParams", engine);
  } else if (engine === "membrane" && !next.membraneParams) {
    next.membraneParams = createSection("membraneParams", engine);
  } else if (engine === "sampler" && !next.samplerConfig) {
    next.samplerConfig = createSection("samplerConfig", engine);
  }

  return next;
}
