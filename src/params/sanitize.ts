/**
 * @file Patch sanitization and validation against specs.
 */

import { SynthEngineType, SynthPatch } from "../types";
import { BUILTIN_INSTRUMENTS } from "../voices/instruments";
import { PATCH_SCHEMA_VERSION } from "./patch";
import { clampParam, getDefaultParam, getParamSpec, ParamSpec } from "./specs";

const VALID_ENGINES = new Set<string>([
  "poly",
  "fm",
  "pluck",
  "moog",
  "drone",
  "membrane",
  "sampler",
]);

const VALID_CATEGORIES = new Set<string>([
  "pad",
  "lead",
  "pluck",
  "bass",
  "drone",
  "percussion",
  "bell",
  "keys",
]);

interface SectionDef {
  required: readonly string[];
  optional: readonly string[];
}

const SECTION_DEFS: Record<string, SectionDef> = {
  envelope: {
    required: ["attack", "decay", "sustain", "release"],
    optional: [],
  },
  oscillator: {
    required: ["type"],
    optional: ["count", "spread"],
  },
  filter: {
    required: ["frequency", "type"],
    optional: ["rolloff", "Q"],
  },
  fmParams: {
    required: ["harmonicity", "modulationIndex", "modulationType", "modulationEnvelope"],
    optional: [],
  },
  pluckParams: {
    required: ["dampening", "resonance", "attackNoise"],
    optional: [],
  },
  moogParams: {
    required: ["drive"],
    optional: ["subOscLevel", "ladderCutoff", "ladderResonance"],
  },
  membraneParams: {
    required: ["pitchDecay", "octaves"],
    optional: [],
  },
  fxSends: {
    required: [],
    optional: [
      "reverbWet",
      "reverbDecay",
      "chorusWet",
      "chorusFrequency",
      "chorusDepth",
      "delayWet",
      "delayTime",
      "delayFeedback",
      "masterVolume",
      "drive",
    ],
  },
};

const MOD_ENV_DEFS: SectionDef = {
  required: ["attack", "decay", "sustain", "release"],
  optional: [],
};

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function sanitizeField(
  path: string,
  raw: unknown,
  engine: SynthEngineType,
  isRequired: boolean
): any {
  const spec = getParamSpec(path);
  if (!spec) return undefined;

  const clamped = clampParam(spec, raw);
  if (clamped !== undefined) {
    return clamped;
  }
  if (isRequired) {
    return getDefaultParam(path, engine);
  }
  return undefined;
}

/**
 * Sanitizes an arbitrary unknown object into a valid, safe SynthPatch.
 * Never throws (catches any errors and returns null).
 * Returns null if fundamental required fields are invalid.
 * Always outputs a clean object with schemaVersion: 1.
 * @param input Untrusted input object.
 */
export function sanitizePatch(input: unknown): SynthPatch | null {
  try {
    if (!isPlainObject(input)) {
      return null;
    }

    // engineType check
    if (typeof input.engineType !== "string" || !VALID_ENGINES.has(input.engineType)) {
      return null;
    }
    const engineType = input.engineType as SynthEngineType;

    // id check: trimmed length 1..100
    if (typeof input.id !== "string") return null;
    const trimmedId = input.id.trim();
    if (trimmedId.length < 1 || trimmedId.length > 100) return null;

    // name check: trimmed length 1..100
    if (typeof input.name !== "string") return null;
    const trimmedName = input.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) return null;

    // schemaVersion: absent or 1 -> OK; anything else -> null
    if (Object.prototype.hasOwnProperty.call(input, "schemaVersion") && input.schemaVersion !== undefined) {
      if (input.schemaVersion !== 1) {
        return null;
      }
    }

    // category: not in enum -> "keys"
    let category: SynthPatch["category"] = "keys";
    if (typeof input.category === "string" && VALID_CATEGORIES.has(input.category)) {
      category = input.category as SynthPatch["category"];
    }

    const output: SynthPatch = {
      schemaVersion: PATCH_SCHEMA_VERSION,
      id: trimmedId,
      name: trimmedName,
      category,
      engineType,
      envelope: {
        attack: 0.08,
        decay: 0.4,
        sustain: 0.3,
        release: 1.4,
      },
    };

    // description: kept only if a string <= 500 chars
    if (typeof input.description === "string" && input.description.length <= 500) {
      output.description = input.description;
    }

    // level: optional patch level in dB (-24..12)
    if (Object.prototype.hasOwnProperty.call(input, "level") && input.level !== undefined) {
      const val = sanitizeField("level", input.level, engineType, false);
      if (val !== undefined) {
        output.level = val;
      } else {
        output.level = getDefaultParam("level", engineType) as number;
      }
    }

    // Helper to sanitize a standard section
    function sanitizeSection(sectionName: string, rawSection: unknown): Record<string, any> | undefined {
      if (!isPlainObject(rawSection)) return undefined;
      const def = SECTION_DEFS[sectionName];
      if (!def) return undefined;

      const res: Record<string, any> = {};

      for (const reqKey of def.required) {
        const fullPath = `${sectionName}.${reqKey}`;
        const rawVal = Object.prototype.hasOwnProperty.call(rawSection, reqKey) ? rawSection[reqKey] : undefined;
        res[reqKey] = sanitizeField(fullPath, rawVal, engineType, true);
      }

      for (const optKey of def.optional) {
        if (Object.prototype.hasOwnProperty.call(rawSection, optKey) && rawSection[optKey] !== undefined) {
          const fullPath = `${sectionName}.${optKey}`;
          const val = sanitizeField(fullPath, rawSection[optKey], engineType, false);
          if (val !== undefined) {
            res[optKey] = val;
          } else {
            // If field was present but invalid, spec says for optional fields:
            // "a missing optional field stays absent; a missing required field gets the spec default"
            // If an optional field is provided but invalid, we fall back to spec default per:
            // "Numeric field: finite number -> clamp via its spec; otherwise the spec default. Choice field: member -> kept; otherwise default."
            const spec = getParamSpec(fullPath);
            if (spec) {
              res[optKey] = getDefaultParam(fullPath, engineType);
            }
          }
        }
      }

      return res;
    }

    // envelope: required; missing or non-object -> all defaults
    if (isPlainObject(input.envelope)) {
      output.envelope = sanitizeSection("envelope", input.envelope) as any;
    } else {
      output.envelope = {
        attack: getDefaultParam("envelope.attack", engineType) as number,
        decay: getDefaultParam("envelope.decay", engineType) as number,
        sustain: getDefaultParam("envelope.sustain", engineType) as number,
        release: getDefaultParam("envelope.release", engineType) as number,
      };
    }

    // oscillator: optional section
    if (isPlainObject(input.oscillator)) {
      output.oscillator = sanitizeSection("oscillator", input.oscillator) as any;
    }

    // filter: optional section
    if (isPlainObject(input.filter)) {
      output.filter = sanitizeSection("filter", input.filter) as any;
    }

    // fmParams: optional section
    if (isPlainObject(input.fmParams)) {
      const rawFm = input.fmParams;
      const fmObj = sanitizeSection("fmParams", rawFm) as any;

      // modulationEnvelope nested section
      const rawModEnv = isPlainObject(rawFm.modulationEnvelope) ? rawFm.modulationEnvelope : {};
      const modEnv: Record<string, any> = {};
      for (const k of MOD_ENV_DEFS.required) {
        const fullPath = `fmParams.modulationEnvelope.${k}`;
        const rawVal = Object.prototype.hasOwnProperty.call(rawModEnv, k) ? rawModEnv[k] : undefined;
        modEnv[k] = sanitizeField(fullPath, rawVal, engineType, true);
      }
      fmObj.modulationEnvelope = modEnv;
      output.fmParams = fmObj;
    }

    // pluckParams: optional section
    if (isPlainObject(input.pluckParams)) {
      output.pluckParams = sanitizeSection("pluckParams", input.pluckParams) as any;
    }

    // moogParams: optional section
    // spec: moogParams.drive is spec.
    // moogParams non-spec fields: finite -> kept, clamped (subOscLevel 0..1, ladderCutoff 20..20000, ladderResonance 0..20); else defaults 0 / 20000 / 0.
    if (isPlainObject(input.moogParams)) {
      const rawMoog = input.moogParams;
      const moogObj = sanitizeSection("moogParams", rawMoog) as any;

      let subOscLevel = 0;
      if (typeof rawMoog.subOscLevel === "number" && Number.isFinite(rawMoog.subOscLevel)) {
        subOscLevel = Math.max(0, Math.min(1, rawMoog.subOscLevel));
      }

      let ladderCutoff = 20000;
      if (typeof rawMoog.ladderCutoff === "number" && Number.isFinite(rawMoog.ladderCutoff)) {
        ladderCutoff = Math.max(20, Math.min(20000, rawMoog.ladderCutoff));
      }

      let ladderResonance = 0;
      if (typeof rawMoog.ladderResonance === "number" && Number.isFinite(rawMoog.ladderResonance)) {
        ladderResonance = Math.max(0, Math.min(20, rawMoog.ladderResonance));
      }

      moogObj.subOscLevel = subOscLevel;
      moogObj.ladderCutoff = ladderCutoff;
      moogObj.ladderResonance = ladderResonance;

      output.moogParams = moogObj;
    }

    // membraneParams: optional section
    if (isPlainObject(input.membraneParams)) {
      output.membraneParams = sanitizeSection("membraneParams", input.membraneParams) as any;
    }

    // fxSends: optional section
    // missing optional field stays absent; fxSends.drive: finite -> clamped 0..1, else dropped.
    if (isPlainObject(input.fxSends)) {
      const rawFx = input.fxSends;
      const fxObj: Partial<SynthPatch["fxSends"]> = {};

      for (const optKey of SECTION_DEFS.fxSends.optional) {
        if (optKey === "drive") continue;
        if (Object.prototype.hasOwnProperty.call(rawFx, optKey) && rawFx[optKey] !== undefined) {
          const fullPath = `fxSends.${optKey}`;
          const val = sanitizeField(fullPath, rawFx[optKey], engineType, false);
          if (val !== undefined) {
            (fxObj as any)[optKey] = val;
          } else {
            (fxObj as any)[optKey] = getDefaultParam(fullPath, engineType);
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(rawFx, "drive") && rawFx.drive !== undefined) {
        if (typeof rawFx.drive === "number" && Number.isFinite(rawFx.drive)) {
          fxObj.drive = Math.max(0, Math.min(1, rawFx.drive));
        }
      }

      output.fxSends = fxObj;
    }

    // samplerConfig:
    // samplerConfig.instrumentId not a BUILTIN_INSTRUMENTS key:
    // engineType "sampler" -> null; other engines -> samplerConfig dropped.
    if (isPlainObject(input.samplerConfig)) {
      const instId = input.samplerConfig.instrumentId;
      const isValidInstrument = typeof instId === "string" && Object.prototype.hasOwnProperty.call(BUILTIN_INSTRUMENTS, instId);
      if (isValidInstrument) {
        output.samplerConfig = { instrumentId: instId };
      } else {
        if (engineType === "sampler") {
          return null;
        }
      }
    } else {
      if (engineType === "sampler") {
        return null;
      }
    }

    return output;
  } catch {
    return null;
  }
}
