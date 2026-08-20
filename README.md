# @mrjoshida/synth-engine

Shared multi-engine synthesis, Web MIDI management, and FX library for the FWDBIAS ecosystem (`orbis-oracular`, `song-forge`, and future audio workstations).

## Features

- **7 Synthesis Paradigms**:
  - **Subtractive Polyphony (`PolyVoice`)**: Roland Juno-106 / Prophet-5 inspired rich saw/pulse pads & leads with 24dB lowpass filtering.
  - **Frequency Modulation (`FMVoice`)**: Yamaha DX7 / Elektron Digitone inspired 2-operator FM bells, chimes & synthwave brass.
  - **Physical Modeling Pluck (`PluckVoice`)**: Mutable Instruments Rings inspired Karplus-Strong physical modeling strings.
  - **Analog Ladder Bass/Lead (`MoogVoice`)**: Minimoog / Sub 37 inspired 24dB ladder filter, sub-oscillator & Chebyshev saturation drive.
  - **Sub Drone (`DroneVoice`)**: Moog Taurus / Buchla inspired continuous cyclical sub & harmonic drones.
  - **Modal Membrane (`MembraneVoice`)**: Mutable Instruments Elements / TR-808 inspired tuned percussion & liquid droplets.
  - **Soundfont / Sampler (`SamplerVoice`)**: Sample-based instrument playback (`Tone.Sampler`) for acoustic Grand Piano, Rhodes Electric Piano, Celesta, and Nylon Guitar.
- **Modular Stereo FX Rack (`FxRack`)**: Juno Stereo Chorus, Dotted Feedback Delay, Algorithmic Reverb, Master Saturation, and Brickwall Limiter (-1 dBFS).
- **22 Curated Factory Presets**: Built-in sound patches covering pads, leads, basses, ambient textures, bells, plucks, percussion, and keys.
- **Web MIDI Access (`WebMidiManager`)**: Live external hardware & DAW Note On/Off routing with automated port discovery and hot-plug listeners.
- **Binary MIDI File Encoder (`MidiFileEncoder`)**: Standard MIDI File (SMF Type 0) binary `.mid` generator for DAW export and drag-and-drop.
- **Music Theory Bridge**: Diatonic scale degree and chord voicing playback via `@mrjoshida/music-theory`.

## Installation

```bash
npm install @mrjoshida/synth-engine
```

## Quick Start

```typescript
import { sharedSynthEngine } from "@mrjoshida/synth-engine";

// 1. Initialize audio context & FX rack
await sharedSynthEngine.init();

// 2. Play a chord using the default PolyVoice
sharedSynthEngine.playChord(["C4", "E4", "G4", "B4"], "2n", 0.8, "poly");

// 3. Load a built-in preset
const preset = sharedSynthEngine.presets.getById("moog-sub-thunder");
if (preset) {
  sharedSynthEngine.loadPatch(preset);
  sharedSynthEngine.playNote("C2", "1n", 0.9, "moog");
}

// 4. Load a sample-based instrument
await sharedSynthEngine.loadInstrument("grand-piano");
sharedSynthEngine.playChord(["A3", "C4", "E4"], "1n", 0.8, "sampler");
```

## Interactive Demo

Run the standalone testing workbench to test voices, presets, FX sliders, sampler instruments, and MIDI connectivity:

```bash
npm run demo
```

## Testing & Building

```bash
# Run unit tests
npm test

# Build CJS, ESM, and TypeScript declarations
npm run build
```

## License

MIT
