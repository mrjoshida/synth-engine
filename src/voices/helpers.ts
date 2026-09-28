/**
 * @file Helpers for oscillator and audio parameters.
 */

import { OscillatorShape } from "../types";

export interface ToneOscillatorOptions {
  type: string;
  count?: number;
  spread?: number;
}

/**
 * Converts a SynthPatch oscillator config to Tone.js oscillator settings.
 * - "fatsaw" -> "fatsawtooth"
 * - count >= 2 with sine/triangle/sawtooth/square -> "fat" + type with count and spread (default 20)
 * - a fat type (fatsaw / fattriangle) without count -> count: 3, spread: 20
 * - "pulse" is never fat
 * @param osc Patch oscillator configuration.
 */
export function toToneOscillator(osc: {
  type: OscillatorShape;
  count?: number;
  spread?: number;
}): ToneOscillatorOptions {
  const rawType = osc.type;
  const count = osc.count;
  const spread = osc.spread ?? 20;

  if (rawType === "pulse") {
    return { type: "pulse" };
  }

  if (rawType === "fatsaw") {
    return {
      type: "fatsawtooth",
      count: count !== undefined ? count : 3,
      spread,
    };
  }

  if (rawType === "fattriangle") {
    return {
      type: "fattriangle",
      count: count !== undefined ? count : 3,
      spread,
    };
  }

  if (count !== undefined && count >= 2) {
    if (rawType === "sine" || rawType === "triangle" || rawType === "sawtooth" || rawType === "square") {
      return {
        type: "fat" + rawType,
        count,
        spread,
      };
    }
  }

  return { type: rawType };
}

/**
 * Sets a Tone.js audio parameter value, using rampTo if smooth is true and rampTo is supported.
 * @param param Target Tone signal or parameter.
 * @param value Target numeric value.
 * @param smooth Whether to ramp smoothly over 0.05 seconds.
 */
export function setToneParam(param: any, value: number, smooth: boolean = false): void {
  if (!param || !Number.isFinite(value)) return;
  if (smooth && typeof param.rampTo === "function") {
    param.rampTo(value, 0.05);
  } else if ("value" in param) {
    param.value = value;
  }
}

/**
 * Converts a decibel level to linear gain.
 * @param db Level in decibels.
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
