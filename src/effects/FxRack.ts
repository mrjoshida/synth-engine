import * as Tone from "tone";
import { FxConfig } from "../types";

export class FxRack {
  private chorus: Tone.Chorus | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private reverb: Tone.Reverb | null = null;
  private limiter: Tone.Limiter | null = null;
  private masterGain: Tone.Gain | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterGain = new Tone.Gain(0.85).connect(this.limiter);

    this.reverb = new Tone.Reverb({
      decay: 4.2,
      wet: 0.35
    }).connect(this.masterGain);
    await this.reverb.generate();

    this.delay = new Tone.FeedbackDelay({
      delayTime: "8n.",
      feedback: 0.3,
      wet: 0.2
    }).connect(this.reverb);

    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.6,
      wet: 0.25
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
    if (cfg.delayWet !== undefined && this.delay) {
      this.delay.wet.value = Math.max(0, Math.min(1.0, cfg.delayWet));
    }
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
