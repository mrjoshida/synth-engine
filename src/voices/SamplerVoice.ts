import * as Tone from "tone";
import { BaseVoice } from "./Voice";
import { SynthPatch, SamplerInstrumentConfig } from "../types";

export class SamplerVoice extends BaseVoice {
  private sampler: Tone.Sampler | null = null;
  private currentInstrumentId: string | null = null;
  private isLoading = false;
  private onLoadCallbacks: (() => void)[] = [];
  private activeLoadRequestId = 0;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.outputNode = new Tone.Gain(1.0);
    if (this.sampler) {
      this.sampler.connect(this.outputNode);
    }
    this.isInitialized = true;
  }

  public async loadInstrument(config: SamplerInstrumentConfig): Promise<void> {
    await this.init();

    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }

    this.isLoading = true;
    this.currentInstrumentId = config.id;
    const requestId = ++this.activeLoadRequestId;
    
    return new Promise((resolve) => {
      let settled = false;
      const onDone = () => {
        if (settled) return;
        settled = true;
        if (this.activeLoadRequestId === requestId) {
          this.isLoading = false;
          this.onLoadCallbacks.forEach(cb => {
            try { cb(); } catch (e) { console.error(e); }
          });
        }
        resolve();
      };

      // Safety timeout: Never hang the caller if any network request is delayed
      const timeoutId = setTimeout(() => {
        if (!settled) {
          if (this.activeLoadRequestId === requestId) {
            console.warn(`SamplerVoice: instrument "${config.id}" load timed out, readying available samples.`);
          }
          onDone();
        }
      }, 5000);

      this.sampler = new Tone.Sampler({
        urls: config.sampleMap,
        baseUrl: config.baseUrl,
        onload: () => {
          clearTimeout(timeoutId);
          onDone();
        },
        onerror: (err) => {
          clearTimeout(timeoutId);
          console.warn(`SamplerVoice warning: failed to fetch some sample files for ${config.id}:`, err);
          onDone();
        }
      });

      // Connect immediately to output node so triggers immediately produce audio
      if (this.outputNode) {
        this.sampler.connect(this.outputNode);
      }
      if (config.volume !== undefined) {
        this.sampler.volume.value = config.volume;
      }
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

  public triggerRelease(note?: string | string[], time?: number): void {
    try {
      if (note && this.sampler) {
        this.sampler.triggerRelease(note, time);
      } else {
        this.sampler?.releaseAll(time);
      }
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
