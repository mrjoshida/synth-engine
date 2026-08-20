import * as Tone from "tone";
import { FxConfig } from "../types";

export class FxRack {
  private chorus: Tone.Chorus | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private reverb: Tone.Freeverb | Tone.Reverb | null = null;
  private limiter: Tone.Limiter | null = null;
  private masterGain: Tone.Gain | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.limiter = new Tone.Limiter(-1).toDestination();
    } catch {
      this.limiter = null;
    }
    const outputTarget: Tone.InputNode = this.limiter || Tone.getDestination();
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

  public setConfig(cfg: Partial<FxConfig>): void {
    if (cfg.masterVolume !== undefined && this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1.0, cfg.masterVolume));
    }
    if (cfg.reverbWet !== undefined && this.reverb) {
      this.reverb.wet.value = Math.max(0, Math.min(1.0, cfg.reverbWet));
    }
    if (cfg.chorusWet !== undefined && this.chorus) {
      this.chorus.wet.value = Math.max(0, Math.min(1.0, cfg.chorusWet));
    }
    if (cfg.chorusFrequency !== undefined && this.chorus) {
      this.chorus.frequency.value = cfg.chorusFrequency;
    }
    if (cfg.chorusDepth !== undefined && this.chorus) {
      this.chorus.depth = cfg.chorusDepth;
    }
    if (cfg.delayWet !== undefined && this.delay) {
      this.delay.wet.value = Math.max(0, Math.min(1.0, cfg.delayWet));
    }
    if (cfg.delayFeedback !== undefined && this.delay) {
      this.delay.feedback.value = Math.max(0, Math.min(0.95, cfg.delayFeedback));
    }
    if (cfg.delayTime !== undefined && this.delay) {
      this.delay.delayTime.value = cfg.delayTime;
    }
  }

  public getConfig(): FxConfig {
    return {
      reverbWet: this.reverb ? Number(this.reverb.wet.value) : 0,
      reverbDecay: 2.5,
      chorusWet: this.chorus ? Number(this.chorus.wet.value) : 0,
      chorusFrequency: this.chorus ? Number(this.chorus.frequency.value) : 1.5,
      chorusDepth: this.chorus ? Number(this.chorus.depth) : 0.6,
      delayWet: this.delay ? Number(this.delay.wet.value) : 0,
      delayTime: this.delay ? String(this.delay.delayTime.value) : "8n.",
      delayFeedback: this.delay ? Number(this.delay.feedback.value) : 0.3,
      drive: 0,
      masterVolume: this.masterGain ? Number(this.masterGain.gain.value) : 0.85
    };
  }

  public dispose(): void {
    this.chorus?.dispose();
    this.delay?.dispose();
    this.reverb?.dispose();
    this.masterGain?.dispose();
    this.limiter?.dispose();
    this.chorus = null;
    this.delay = null;
    this.reverb = null;
    this.masterGain = null;
    this.limiter = null;
    this.isInitialized = false;
  }
}
