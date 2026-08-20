import { SynthPatch } from "../types";

export const BUILTIN_SYNTH_PRESETS: SynthPatch[] = [
  {
    id: "juno-elysium",
    name: "Juno Elysium",
    category: "pad",
    engineType: "poly",
    description: "Warm, slow-blooming analog polyphonic pad with rich stereo chorus.",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.12, decay: 0.5, sustain: 0.6, release: 1.8 },
    filter: { frequency: 3200, type: "lowpass", rolloff: -24, Q: 1.2 },
    fxSends: { chorusWet: 0.45, reverbWet: 0.4 }
  },
  {
    id: "dx-crystal-chime",
    name: "DX Crystal Chime",
    category: "bell",
    engineType: "fm",
    description: "3.5:1 ratio FM metallic glass chime for high-velocity celestial crossing notes.",
    envelope: { attack: 0.002, decay: 0.9, sustain: 0.05, release: 1.5 },
    fmParams: {
      harmonicity: 3.5,
      modulationIndex: 14,
      modulationType: "sine",
      modulationEnvelope: { attack: 0.004, decay: 0.6, sustain: 0.02, release: 1.0 }
    },
    fxSends: { delayWet: 0.25, reverbWet: 0.45 }
  },
  {
    id: "moog-model-24",
    name: "Moog Model 24",
    category: "bass",
    engineType: "moog",
    description: "Punchy 24dB ladder-filtered analog bass with subtle saturation drive.",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.015, decay: 0.35, sustain: 0.35, release: 0.5 },
    filter: { frequency: 850, type: "lowpass", rolloff: -24, Q: 4.0 },
    moogParams: { subOscLevel: 0.8, ladderCutoff: 850, ladderResonance: 4.0, drive: 0.4 },
    fxSends: { chorusWet: 0.15, reverbWet: 0.2 }
  },
  {
    id: "moog-starlight-lead",
    name: "Moog Starlight Lead",
    category: "lead",
    engineType: "moog",
    description: "Expressive cutting analog lead with ladder resonance and tape delay.",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.03, decay: 0.4, sustain: 0.7, release: 0.8 },
    filter: { frequency: 3800, type: "lowpass", rolloff: -24, Q: 3.2 },
    moogParams: { subOscLevel: 0.3, ladderCutoff: 3800, ladderResonance: 3.2, drive: 0.6 },
    fxSends: { delayWet: 0.35, reverbWet: 0.3 }
  },
  {
    id: "rings-resonant-pluck",
    name: "Rings Resonant Pluck",
    category: "pluck",
    engineType: "pluck",
    description: "Physical modeling Karplus-Strong string with high tension and acoustic resonance.",
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.0, release: 0.6 },
    pluckParams: { dampening: 4200, resonance: 0.95, attackNoise: 1.2 },
    fxSends: { reverbWet: 0.35 }
  },
  {
    id: "taurus-void-drone",
    name: "Taurus Void Drone",
    category: "drone",
    engineType: "drone",
    description: "Deep, grounding root-fifth sub oscillator with slow cyclical harmonic sweep.",
    oscillator: { type: "triangle" },
    envelope: { attack: 1.5, decay: 1.0, sustain: 0.85, release: 3.0 },
    fxSends: { chorusWet: 0.3, reverbWet: 0.5 }
  },
  {
    id: "obsidian-fluid-drop",
    name: "Obsidian Fluid Drop",
    category: "percussion",
    engineType: "membrane",
    description: "Tuned modal membrane body with rapid pitch decay for liquid droplets.",
    envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.6 },
    membraneParams: { pitchDecay: 0.06, octaves: 4.5 },
    fxSends: { reverbWet: 0.4 }
  },
  {
    id: "moog-sub-thunder",
    name: "Moog Sub Thunder",
    category: "bass",
    engineType: "moog",
    description: "Deep 24dB sub-bass with heavy saturation and slow filter sweep",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.8 },
    filter: { frequency: 400, type: "lowpass", rolloff: -24, Q: 5.0 },
    moogParams: { subOscLevel: 1.0, ladderCutoff: 400, ladderResonance: 5.0, drive: 0.7 },
    fxSends: { chorusWet: 0.1, reverbWet: 0.15 }
  },
  {
    id: "moog-acid-squelch",
    name: "Moog Acid Squelch",
    category: "bass",
    engineType: "moog",
    description: "Classic 303-style resonant squelch bass with high Q and fast decay",
    oscillator: { type: "square" },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.3 },
    filter: { frequency: 1200, type: "lowpass", rolloff: -24, Q: 8.0 },
    moogParams: { subOscLevel: 0.5, ladderCutoff: 1200, ladderResonance: 8.0, drive: 0.55 },
    fxSends: { delayWet: 0.2, reverbWet: 0.1 }
  },
  {
    id: "moog-brass-stab",
    name: "Moog Brass Stab",
    category: "lead",
    engineType: "moog",
    description: "Bright punchy brass-like mono stab with fast attack",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.008, decay: 0.3, sustain: 0.6, release: 0.4 },
    filter: { frequency: 2800, type: "lowpass", rolloff: -24, Q: 2.5 },
    moogParams: { subOscLevel: 0.4, ladderCutoff: 2800, ladderResonance: 2.5, drive: 0.5 },
    fxSends: { chorusWet: 0.2, delayWet: 0.15, reverbWet: 0.25 }
  },
  {
    id: "poly-neon-sunrise",
    name: "Poly Neon Sunrise",
    category: "pad",
    engineType: "poly",
    description: "Wide stereo detuned sawtooth pad with heavy chorus and lush reverb. Classic synthwave wash.",
    oscillator: { type: "fatsaw", count: 3, spread: 25 },
    envelope: { attack: 0.3, decay: 0.8, sustain: 0.7, release: 2.5 },
    filter: { frequency: 2600, type: "lowpass", rolloff: -24, Q: 0.8 },
    fxSends: { chorusWet: 0.6, delayWet: 0.2, reverbWet: 0.55 }
  },
  {
    id: "poly-retrowave-glass",
    name: "Poly Retrowave Glass",
    category: "pad",
    engineType: "poly",
    description: "Bright triangle-pulse hybrid pad with shimmering delay tails",
    oscillator: { type: "fattriangle", count: 2, spread: 15 },
    envelope: { attack: 0.15, decay: 0.6, sustain: 0.5, release: 2.0 },
    filter: { frequency: 800, type: "highpass", rolloff: -12, Q: 1.0 },
    fxSends: { chorusWet: 0.35, delayWet: 0.4, reverbWet: 0.45 }
  },
  {
    id: "fm-synthwave-brass",
    name: "FM Synthwave Brass",
    category: "pad",
    engineType: "fm",
    description: "Warm 2-op FM brass pad with slow attack bloom",
    envelope: { attack: 0.2, decay: 0.7, sustain: 0.6, release: 1.5 },
    fmParams: { harmonicity: 2.0, modulationIndex: 8, modulationType: "sine", modulationEnvelope: { attack: 0.15, decay: 0.5, sustain: 0.3, release: 1.0 } },
    fxSends: { chorusWet: 0.4, reverbWet: 0.35 }
  },
  {
    id: "fm-ambient-shimmer",
    name: "FM Ambient Shimmer",
    category: "bell",
    engineType: "fm",
    description: "Ethereal high-ratio FM texture with long reverb and subtle pitch drift",
    envelope: { attack: 0.01, decay: 1.5, sustain: 0.02, release: 3.0 },
    fmParams: { harmonicity: 5.5, modulationIndex: 18, modulationType: "triangle", modulationEnvelope: { attack: 0.002, decay: 1.0, sustain: 0.01, release: 2.0 } },
    fxSends: { delayWet: 0.3, reverbWet: 0.6 }
  },
  {
    id: "drone-arctic-wind",
    name: "Drone Arctic Wind",
    category: "drone",
    engineType: "drone",
    description: "Icy high-register drone with slow filter sweep and deep reverb",
    oscillator: { type: "sine" },
    envelope: { attack: 2.0, decay: 1.5, sustain: 0.9, release: 4.0 },
    fxSends: { chorusWet: 0.35, reverbWet: 0.65 }
  },
  {
    id: "poly-microtonal-haze",
    name: "Poly Microtonal Haze",
    category: "pad",
    engineType: "poly",
    description: "Thick unison pad using fatsaw with wide spread for natural beating frequencies",
    oscillator: { type: "fatsaw", count: 5, spread: 40 },
    envelope: { attack: 0.5, decay: 1.0, sustain: 0.8, release: 3.5 },
    filter: { frequency: 1800, type: "lowpass", rolloff: -24, Q: 0.5 },
    fxSends: { chorusWet: 0.5, delayWet: 0.15, reverbWet: 0.6 }
  },
  {
    id: "pluck-music-box",
    name: "Pluck Music Box",
    category: "pluck",
    engineType: "pluck",
    description: "Delicate high-dampening pluck with crystalline reverb",
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.5 },
    pluckParams: { dampening: 6000, resonance: 0.88, attackNoise: 0.8 },
    fxSends: { delayWet: 0.2, reverbWet: 0.5 }
  },
  {
    id: "pluck-koto-silk",
    name: "Pluck Koto Silk",
    category: "pluck",
    engineType: "pluck",
    description: "Low-dampening, high-resonance pluck with minimal attack noise. Koto-inspired sustain.",
    envelope: { attack: 0.001, decay: 0.8, sustain: 0.0, release: 1.0 },
    pluckParams: { dampening: 2800, resonance: 0.98, attackNoise: 0.4 },
    fxSends: { chorusWet: 0.15, reverbWet: 0.3 }
  },
  {
    id: "membrane-taiko-boom",
    name: "Membrane Taiko Boom",
    category: "percussion",
    engineType: "membrane",
    description: "Deep tuned membrane hit with wide octave sweep and long pitch decay",
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.02, release: 1.0 },
    membraneParams: { pitchDecay: 0.12, octaves: 6 },
    fxSends: { reverbWet: 0.45 }
  },
  {
    id: "sampler-grand-piano",
    name: "Grand Piano",
    category: "keys",
    engineType: "sampler",
    description: "Concert grand piano with natural dynamics and sustain. Sample-based instrument.",
    envelope: { attack: 0.0, decay: 0.0, sustain: 1.0, release: 0.5 },
    samplerConfig: { instrumentId: "grand-piano" },
    fxSends: { reverbWet: 0.25, chorusWet: 0.0 }
  },
  {
    id: "sampler-electric-piano",
    name: "Electric Piano (Rhodes)",
    category: "keys",
    engineType: "sampler",
    description: "Warm Rhodes-style electric piano with subtle chorus and natural warmth.",
    envelope: { attack: 0.0, decay: 0.0, sustain: 1.0, release: 0.3 },
    samplerConfig: { instrumentId: "electric-piano" },
    fxSends: { reverbWet: 0.2, chorusWet: 0.3 }
  },
  {
    id: "sampler-celesta",
    name: "Celesta",
    category: "bell",
    engineType: "sampler",
    description: "Delicate orchestral celesta with ethereal reverb. Sample-based bell tones.",
    envelope: { attack: 0.0, decay: 0.0, sustain: 1.0, release: 0.8 },
    samplerConfig: { instrumentId: "celesta" },
    fxSends: { reverbWet: 0.5, delayWet: 0.15 }
  }
];
