import { SynthPatch } from "../types";
import { BUILTIN_SYNTH_PRESETS } from "./builtinPresets";

export class PresetManager {
  private patches: Map<string, SynthPatch> = new Map();

  constructor() {
    BUILTIN_SYNTH_PRESETS.forEach((p) => this.patches.set(p.id, p));
  }

  public getAll(): SynthPatch[] {
    return Array.from(this.patches.values());
  }

  public getById(id: string): SynthPatch | undefined {
    return this.patches.get(id);
  }

  public register(patch: SynthPatch): void {
    this.patches.set(patch.id, patch);
  }

  public serialize(): string {
    return JSON.stringify(Array.from(this.patches.values()), null, 2);
  }

  public deserialize(json: string): boolean {
    try {
      const parsed: SynthPatch[] = JSON.parse(json);
      parsed.forEach((p) => this.patches.set(p.id, p));
      return true;
    } catch {
      return false;
    }
  }
}
