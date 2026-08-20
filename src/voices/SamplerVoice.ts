import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch, SamplerInstrumentConfig } from "../types";

export class SamplerVoice extends BaseVoice {
  private sampler: Tone.Sampler | null = null;
  private currentInstrumentId: string | null = null;
  private isLoading = false;
  private onLoadCallbacks: (() => void)[] = [];

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.outputNode = new Tone.Gain(1.0);
    this.isInitialized = true;
  }

  public async loadInstrument(config: SamplerInstrumentConfig): Promise<void> {
    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }

    this.isLoading = true;
    
    return new Promise((resolve) => {
      this.sampler = new Tone.Sampler({
        urls: config.sampleMap,
        baseUrl: config.baseUrl,
        onload: () => {
          this.isLoading = false;
          if (this.sampler && this.outputNode) {
            this.sampler.connect(this.outputNode);
            if (config.volume !== undefined) {
              this.sampler.volume.value = config.volume;
            }
          }
          this.currentInstrumentId = config.id;
          
          this.onLoadCallbacks.forEach(cb => cb());
          
          resolve();
        }
      });
    });
  }

  public getLoadedInstrumentId(): string | null {
    return this.currentInstrumentId;
  }

  public isLoadingInstrument(): boolean {
    return this.isLoading;
  }

  public onLoad(cb: () => void): () => void {
    this.onLoadCallbacks.push(cb);
    return () => {
      this.onLoadCallbacks = this.onLoadCallbacks.filter(callback => callback !== cb);
    };
  }

  public triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity?: number): void {
    try {
      this.sampler?.triggerAttackRelease(note, duration, time, velocity);
    } catch (e) {
      console.warn("SamplerVoice failed to triggerAttackRelease:", e);
    }
  }

  public triggerAttack(note: string | string[], time?: number, velocity?: number): void {
    try {
      this.sampler?.triggerAttack(note, time, velocity);
    } catch (e) {
      console.warn("SamplerVoice failed to triggerAttack:", e);
    }
  }

  public triggerRelease(time?: number): void {
    try {
      this.sampler?.releaseAll(time);
    } catch (e) {
      console.warn("SamplerVoice failed to triggerRelease:", e);
    }
  }

  public applyPatch(patch: SynthPatch): void {
    if (patch.samplerConfig) {
      console.log(`Applying sampler config: ${patch.samplerConfig.instrumentId}`);
    }
  }

  public dispose(): void {
    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }
    if (this.outputNode) {
      this.outputNode.dispose();
      this.outputNode = null;
    }
    this.isInitialized = false;
  }
}
