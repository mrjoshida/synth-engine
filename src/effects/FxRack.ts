import * as Tone from "tone";
import { FxConfig } from "../types";
import { setToneParam } from "../voices/helpers";
import { HARD_STOP_RELEASE_S } from "../voices/Voice";

interface InFlightMute {
  until: number;
  masterVolume: number;
  roomSize?: number;
  delayFeedback?: number;
  delayWet?: number;
}

export const CLIP_RANGE = 4;

/** Best-effort disposal of a partially constructed node; never throws. */
function disposeQuietly(node: { dispose(): unknown } | null): void {
  try {
    node?.dispose();
  } catch {
    // Nothing further to release.
  }
}

/**
 * Generates an odd-symmetric, monotonic soft-clipping transfer curve.
 * Below the knee, the transfer curve is the identity (slope = 1).
 * Above the knee, the curve smoothly saturates towards the ceiling via tanh.
 *
 * @param length Array length (table resolution).
 * @param range Input range [-range, range] mapped to the table across [-1, 1].
 * @param knee Normalized threshold below which the curve is linear.
 * @param ceiling Upper bound asymptote (|y| < ceiling).
 * @throws RangeError unless range is finite and > 0, and 0 <= knee < ceiling (both finite).
 */
export function softClipCurve(
  length = 8192,
  range = 4,
  knee = 0.9,
  ceiling = 0.99
): Float32Array {
  if (
    !Number.isFinite(range) ||
    range <= 0 ||
    !Number.isFinite(knee) ||
    !Number.isFinite(ceiling) ||
    knee < 0 ||
    ceiling <= knee
  ) {
    throw new RangeError("softClipCurve: expected finite range > 0 and 0 <= knee < ceiling");
  }
  if (length <= 1) {
    return new Float32Array(length);
  }
  const curve = new Float32Array(length);
  const denom = length - 1;
  const delta = ceiling - knee;
  for (let i = 0; i < length; i++) {
    const u = -1 + (2 * i) / denom;
    const x = u * range;
    const absX = Math.abs(x);
    if (absX <= knee) {
      curve[i] = x;
    } else {
      const sign = x < 0 ? -1 : 1;
      curve[i] = sign * (knee + delta * Math.tanh((absX - knee) / delta));
    }
  }
  return curve;
}

export class FxRack {
  private chorus: Tone.Chorus | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private reverb: Tone.Freeverb | Tone.Reverb | null = null;
  private compressor: Tone.Compressor | null = null;
  private clipGain: Tone.Gain | null = null;
  private waveShaper: Tone.WaveShaper | null = null;
  private masterGain: Tone.Gain | null = null;
  private isInitialized = false;
  private inFlightMute: InFlightMute | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // Soft-clip safety stage: Tone.Gain(1/CLIP_RANGE) -> Tone.WaveShaper(curve) with oversample '4x' -> destination.
    try {
      const curve = softClipCurve(8192, CLIP_RANGE);
      this.waveShaper = new Tone.WaveShaper(curve);
      this.waveShaper.oversample = "4x";
      this.waveShaper.toDestination();
      this.clipGain = new Tone.Gain(1 / CLIP_RANGE).connect(this.waveShaper);
    } catch {
      // Release a partially built stage so no connected-but-unfed node stays in the graph.
      disposeQuietly(this.clipGain);
      disposeQuietly(this.waveShaper);
      this.clipGain = null;
      this.waveShaper = null;
    }

    const clipperInput: Tone.InputNode = this.clipGain || Tone.getDestination();

    // Tone.Limiter uses the DynamicsCompressorNode default 30 dB knee, which extends
    // above threshold in Web Audio, plus automatic makeup gain ((1 / fullRangeGain) ^ 0.6).
    // Replacing it with Tone.Compressor with knee: 0, ratio: 20, threshold: -6 dBFS,
    // attack: 2 ms, and release: 120 ms holds steady-state output near -2 dBFS (about -2.6 dBFS
    // at threshold, -1.3 dBFS at +20 dBFS input, after the ~+3.4 dB automatic makeup gain).
    // The soft clipper below catches transient overshoot before the compressor reacts.
    try {
      this.compressor = new Tone.Compressor({
        threshold: -6,
        ratio: 20,
        knee: 0,
        attack: 0.002,
        release: 0.12,
      });
      this.compressor.connect(clipperInput);
    } catch {
      disposeQuietly(this.compressor);
      this.compressor = null;
    }

    const outputTarget: Tone.InputNode = this.compressor || clipperInput;
    this.masterGain = new Tone.Gain(0.85).connect(outputTarget);

    // Freeverb operates purely on native Web Audio nodes without AudioWorklet blob origin restrictions
    this.reverb = new Tone.Freeverb({
      roomSize: 0.75,
      dampening: 3500,
      wet: 0.15
    }).connect(this.masterGain);

    this.delay = new Tone.FeedbackDelay({
      delayTime: "8n.",
      feedback: 0.3,
      wet: 0.0
    }).connect(this.reverb);

    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.6,
      wet: 0.0
    }).connect(this.delay);
    this.chorus.start();

    this.isInitialized = true;
  }

  public getInput(): Tone.InputNode {
    return this.chorus || this.masterGain || Tone.getDestination();
  }

  private isMuteActive(): boolean {
    if (!this.inFlightMute) return false;
    let now = 0;
    try {
      now = Tone.now();
    } catch {
      now = 0;
    }
    if (now >= this.inFlightMute.until) {
      this.inFlightMute = null;
      return false;
    }
    return true;
  }

  public setConfig(cfg: Partial<FxConfig>, opts?: { smooth?: boolean }): void {
    const smooth = opts?.smooth ?? false;
    const muteActive = this.isMuteActive();
    let now = 0;
    if (muteActive) {
      try {
        now = Tone.now();
      } catch {
        now = 0;
      }
    }

    if (cfg.masterVolume !== undefined && this.masterGain) {
      const vol = Math.max(0, Math.min(1.0, cfg.masterVolume));
      if (muteActive && this.inFlightMute) {
        this.inFlightMute.masterVolume = vol;
        const gain = this.masterGain.gain as any;
        gain?.cancelScheduledValues?.(now);
      }
      setToneParam(this.masterGain.gain, vol, smooth);
    }

    if (cfg.reverbWet !== undefined && this.reverb) {
      setToneParam(this.reverb.wet, Math.max(0, Math.min(1.0, cfg.reverbWet)), smooth);
    }

    if (cfg.reverbDecay !== undefined && this.reverb) {
      if ("roomSize" in this.reverb) {
        const rsVal = Math.max(0.01, Math.min(1.0, cfg.reverbDecay / 5));
        if (muteActive && this.inFlightMute) {
          this.inFlightMute.roomSize = rsVal;
          const rs = (this.reverb as any).roomSize;
          rs?.cancelScheduledValues?.(now);
        }
        setToneParam((this.reverb as any).roomSize, rsVal, smooth);
      } else if ("decay" in this.reverb) {
        (this.reverb as any).decay = Math.max(0.1, cfg.reverbDecay);
      }
    }

    if (cfg.chorusWet !== undefined && this.chorus) {
      setToneParam(this.chorus.wet, Math.max(0, Math.min(1.0, cfg.chorusWet)), smooth);
    }
    if (cfg.chorusFrequency !== undefined && this.chorus) {
      setToneParam(this.chorus.frequency, cfg.chorusFrequency, smooth);
    }
    if (cfg.chorusDepth !== undefined && this.chorus) {
      this.chorus.depth = cfg.chorusDepth;
    }

    if (cfg.delayWet !== undefined && this.delay) {
      const dWet = Math.max(0, Math.min(1.0, cfg.delayWet));
      if (muteActive && this.inFlightMute) {
        this.inFlightMute.delayWet = dWet;
        const wet = this.delay.wet as any;
        wet?.cancelScheduledValues?.(now);
      }
      setToneParam(this.delay.wet, dWet, smooth);
    }

    if (cfg.delayFeedback !== undefined && this.delay) {
      const fbVal = Math.max(0, Math.min(0.95, cfg.delayFeedback));
      if (muteActive && this.inFlightMute) {
        this.inFlightMute.delayFeedback = fbVal;
        const fb = this.delay.feedback as any;
        fb?.cancelScheduledValues?.(now);
      }
      setToneParam(this.delay.feedback, fbVal, smooth);
    }

    if (cfg.delayTime !== undefined && this.delay) {
      if (typeof cfg.delayTime === "number") {
        setToneParam(this.delay.delayTime, cfg.delayTime, smooth);
      } else {
        this.delay.delayTime.value = cfg.delayTime;
      }
    }
  }

  public getConfig(): FxConfig {
    const muteActive = this.isMuteActive();
    const cached = muteActive ? this.inFlightMute : null;

    let reverbDecay = 2.5;
    if (cached?.roomSize !== undefined) {
      reverbDecay = cached.roomSize * 5;
    } else if (this.reverb) {
      if ("roomSize" in this.reverb) {
        reverbDecay = Number((this.reverb as any).roomSize.value) * 5;
      } else if ("decay" in this.reverb) {
        reverbDecay = Number((this.reverb as any).decay);
      }
    }

    const masterVolume = cached?.masterVolume !== undefined
      ? cached.masterVolume
      : (this.masterGain ? Number(this.masterGain.gain.value) : 0.85);

    const delayFeedback = cached?.delayFeedback !== undefined
      ? cached.delayFeedback
      : (this.delay ? Number(this.delay.feedback.value) : 0.3);

    const delayWet = cached?.delayWet !== undefined
      ? cached.delayWet
      : (this.delay ? Number(this.delay.wet.value) : 0);

    return {
      reverbWet: this.reverb ? Number(this.reverb.wet.value) : 0,
      reverbDecay,
      chorusWet: this.chorus ? Number(this.chorus.wet.value) : 0,
      chorusFrequency: this.chorus ? Number(this.chorus.frequency.value) : 1.5,
      chorusDepth: this.chorus ? Number(this.chorus.depth) : 0.6,
      delayWet,
      delayTime: this.delay ? String(this.delay.delayTime.value) : "8n.",
      delayFeedback,
      drive: 0,
      masterVolume
    };
  }

  public hardMute(time: number, holdSeconds: number = 0.1): void {
    if (!this.isInitialized) return;

    // Restore targets: a re-entrant call reuses the values captured by the in-flight mute, so it
    // never "restores" the transient muted values; otherwise the live params are the targets.
    const inFlight = this.isMuteActive() ? this.inFlightMute : null;
    const targetVol =
      inFlight?.masterVolume ?? (this.masterGain ? Number(this.masterGain.gain.value) : 0.85);
    const targetRoomSize =
      this.reverb && "roomSize" in this.reverb
        ? inFlight?.roomSize ?? Number((this.reverb as any).roomSize.value ?? 0.75)
        : undefined;
    const targetDelayFb = this.delay
      ? inFlight?.delayFeedback ?? Number(this.delay.feedback.value ?? 0.3)
      : undefined;
    const targetDelayWet = this.delay
      ? inFlight?.delayWet ?? Number(this.delay.wet.value ?? 0)
      : undefined;

    let delaySeconds = 2;
    if (this.delay) {
      try {
        const raw = this.delay.delayTime?.value;
        if (typeof raw === "number") {
          delaySeconds = raw;
        } else if (typeof raw === "string") {
          delaySeconds = Tone.Time(raw).toSeconds();
        }
        if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
          delaySeconds = 2;
        }
      } catch {
        delaySeconds = 2;
      }
    }

    const restoreTimeDelay = time + HARD_STOP_RELEASE_S + delaySeconds + 0.05;
    const restoreTimeMaster = time + holdSeconds + 0.02;
    const until = Math.max(restoreTimeMaster, time + holdSeconds, restoreTimeDelay);

    this.inFlightMute = {
      until,
      masterVolume: targetVol,
      roomSize: targetRoomSize,
      delayFeedback: targetDelayFb,
      delayWet: targetDelayWet
    };

    // 1. masterGain.gain automation
    if (this.masterGain) {
      const gain = this.masterGain.gain as any;
      if (gain) {
        const currentVal = Number(gain.value ?? 1);
        gain.cancelScheduledValues?.(time);
        gain.setValueAtTime?.(currentVal, time);
        gain.linearRampToValueAtTime?.(0, time + HARD_STOP_RELEASE_S);
        gain.setValueAtTime?.(0, time + holdSeconds);
        gain.linearRampToValueAtTime?.(targetVol, restoreTimeMaster);
      }
    }

    // 2. reverb roomSize (guarded for Tone.Reverb without roomSize)
    if (this.reverb && "roomSize" in this.reverb && targetRoomSize !== undefined) {
      const rs = (this.reverb as any).roomSize;
      if (rs) {
        rs.cancelScheduledValues?.(time);
        rs.setValueAtTime?.(0, time + HARD_STOP_RELEASE_S);
        rs.setValueAtTime?.(targetRoomSize, time + holdSeconds);
      }
    }

    // 3. delay feedback and wet
    if (this.delay) {
      const fb = this.delay.feedback as any;
      if (fb && targetDelayFb !== undefined) {
        fb.cancelScheduledValues?.(time);
        fb.setValueAtTime?.(Number(fb.value ?? 0), time);
        if (typeof fb.linearRampToValueAtTime === "function") {
          fb.linearRampToValueAtTime(0, time + HARD_STOP_RELEASE_S);
        } else {
          fb.setValueAtTime?.(0, time + HARD_STOP_RELEASE_S);
        }
        fb.setValueAtTime?.(targetDelayFb, restoreTimeDelay);
      }

      const wet = this.delay.wet as any;
      if (wet && targetDelayWet !== undefined) {
        wet.cancelScheduledValues?.(time);
        wet.setValueAtTime?.(Number(wet.value ?? 0), time);
        if (typeof wet.linearRampToValueAtTime === "function") {
          wet.linearRampToValueAtTime(0, time + HARD_STOP_RELEASE_S);
        } else {
          wet.setValueAtTime?.(0, time + HARD_STOP_RELEASE_S);
        }
        wet.setValueAtTime?.(targetDelayWet, restoreTimeDelay);
      }
    }
  }

  public dispose(): void {
    if (this.chorus && typeof (this.chorus as any).stop === "function") {
      try {
        (this.chorus as any).stop();
      } catch (e) {
        console.warn("FxRack chorus stop error:", e);
      }
    }
    this.chorus?.dispose();
    this.delay?.dispose();
    this.reverb?.dispose();
    this.masterGain?.dispose();
    this.compressor?.dispose();
    this.clipGain?.dispose();
    this.waveShaper?.dispose();
    this.chorus = null;
    this.delay = null;
    this.reverb = null;
    this.masterGain = null;
    this.compressor = null;
    this.clipGain = null;
    this.waveShaper = null;
    this.isInitialized = false;
    this.inFlightMute = null;
  }
}
