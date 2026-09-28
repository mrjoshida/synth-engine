import * as Tone from "tone";
import { BaseVoice, ApplyPatchOptions, HARD_STOP_RELEASE_S } from "./Voice";
import { SynthEngineType, SynthPatch, SamplerInstrumentConfig } from "../types";

export class SamplerVoice extends BaseVoice {
  protected readonly engine: SynthEngineType = "sampler";
  private sampler: Tone.Sampler | null = null;
  private currentInstrumentId: string | null = null;
  private isLoading = false;
  private onLoadCallbacks: (() => void)[] = [];
  private activeLoadRequestId = 0;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.outputNode = new Tone.Gain(1.0);
    this.applyLevel(this.currentPatch(), { smooth: false });
    if (this.sampler) {
      this.sampler.connect(this.outputNode);
    }
    this.isInitialized = true;
  }

  public async loadInstrument(config: SamplerInstrumentConfig): Promise<void> {
    await this.init();
    if (!this.isInitialized) return;

    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }

    this.isLoading = true;
    const requestId = ++this.activeLoadRequestId;
    
    return new Promise((resolve) => {
      let settled = false;
      const onDone = () => {
        if (settled) return;
        settled = true;
        if (this.activeLoadRequestId === requestId && this.isInitialized) {
          this.isLoading = false;
          this.currentInstrumentId = config.id;
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

      try {
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
      } catch (err) {
        clearTimeout(timeoutId);
        console.error(`SamplerVoice error instantiating Tone.Sampler for ${config.id}:`, err);
        onDone();
      }

      // Connect immediately to output node so triggers immediately produce audio
      if (this.outputNode && this.sampler) {
        this.sampler.connect(this.outputNode);
      }
      if (config.volume !== undefined && this.sampler) {
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

  public override stopNote(key: string, time?: number): void {
    const note = this.keyToNoteMap.get(key);
    if (note !== undefined) {
      this.keyToNoteMap.delete(key);
      let stillMapped = false;
      for (const mappedNote of this.keyToNoteMap.values()) {
        if (mappedNote === note) {
          stillMapped = true;
          break;
        }
      }
      if (!stillMapped) {
        this.triggerRelease(note, time);
      }
    }
  }

  public override triggerRelease(note?: string | string[], time?: number): void {
    if (note === undefined) {
      this.clearKeyMap();
    }
    try {
      const hasNote = note !== undefined && (!Array.isArray(note) || note.length > 0);
      if (hasNote && this.sampler) {
        this.sampler.triggerRelease(note!, time);
      } else {
        this.sampler?.releaseAll(time);
      }
    } catch (e) {
      console.warn("SamplerVoice failed to triggerRelease:", e);
    }
  }

  public override hardStop(time?: number): void {
    this.clearKeyMap();
    if (this.sampler) {
      const samplerAny = this.sampler as any;
      if (samplerAny._activeSources instanceof Map) {
        for (const sources of samplerAny._activeSources.values()) {
          if (Array.isArray(sources)) {
            for (const source of sources) {
              if (source && typeof source === "object") {
                try {
                  source.fadeOut = HARD_STOP_RELEASE_S;
                } catch {
                  // Ignore if property is read-only or setter throws
                }
              }
            }
          }
        }
      }
      try {
        this.sampler.releaseAll(time);
      } catch (e) {
        console.warn("SamplerVoice failed to hardStop:", e);
      }
    }
  }

  public applyPatch(patch: SynthPatch, opts?: ApplyPatchOptions): void {
    this.applyLevel(patch, opts);
    if (patch.samplerConfig) {
      console.log(`Applying sampler config: ${patch.samplerConfig.instrumentId}`);
    }
  }

  public dispose(): void {
    this.activeLoadRequestId++;
    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }
    if (this.outputNode) {
      this.outputNode.dispose();
      this.outputNode = null;
    }
    this.onLoadCallbacks = [];
    this.currentInstrumentId = null;
    this.clearKeyMap();
    this.isInitialized = false;
  }
}
