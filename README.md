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

## Standalone Testing (Zero Additional Tools / Dev Servers)

### 1. Browser Workbench (`workbench.html`)
Open [`workbench.html`](./workbench.html) directly in any modern browser (e.g. `open workbench.html` or double click the file). No local dev server, bundler, or build tool process is required.

Features:
- Live real-time audio oscilloscope / waveform display.
- One-click trigger & preview for all 7 synthesis engines & 22 presets.
- Sampled instrument loader (Grand Piano, Rhodes, Celesta, Nylon Guitar).
- Playable 2-octave keyboard with mouse and computer keyboard hotkeys (`A-S-D-F...`).
- Music theory scale degree and diatonic chord voicing player.
- Live FX rack parameter modulation.
- MIDI hardware monitor & `.mid` session file export.

### 2. Standalone Terminal CLI (`test-cli.mjs`)
Run headless sanity tests in any Node environment without a browser:

```bash
npm run test:cli
```

## Testing & Building

```bash
# Run unit test suite (Vitest)
npm test

# Run interactive Vite demo
npm run demo

# Build CJS, ESM, IIFE standalone bundle, and TypeScript declarations
npm run build
```

## License

MIT
