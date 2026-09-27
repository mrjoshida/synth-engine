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

## Sustained Notes & Interactive Play (v0.2.0)

```typescript
import { SynthEngine } from "@mrjoshida/synth-engine";

const engine = new SynthEngine();
// From a user gesture. noteOn/noteOff are ignored until init() resolves.
// lookAhead: 0 removes Tone's default 0.1 s scheduling delay for live play.
// webMidi: false skips the engine's own MIDI access request (and permission prompt)
// when your app manages Web MIDI itself. init() is safe to call more than once.
await engine.init({ latencyHint: "interactive", lookAhead: 0 });

// Audio Context unlock on user gesture
await engine.unlock();

// Note On with sustained hold (accepts MIDI note number or pitch string)
engine.noteOn(60, 0.8, { voiceType: "poly", channel: 1 }); // C4
engine.noteOn("G4", 0.7);

// Note Off
engine.noteOff(60);
engine.noteOff("G4");

// Emergency stop: silences all 7 engine voices and sends MIDI All Notes Off
engine.panic();
```

## Audio Lifecycle Management

```typescript
// Monitor Web Audio state changes (suspended, running, closed, interrupted)
const unsubscribe = engine.onAudioStateChange((state) => {
  console.log("Audio context state:", state);
});

// Current state
console.log(engine.getAudioState());

// Explicit resume
await engine.resume();
```

## Web MIDI Enhancements

```typescript
import { parseMidiMessage, WebMidiManager } from "@mrjoshida/synth-engine";

const midi = new WebMidiManager();
await midi.requestAccess({ sysex: true });

// Listen to incoming MIDI messages (parsed automatically)
midi.onMessage((event) => {
  if (event.type === "noteon") {
    console.log(`Note on: ${event.note} vel: ${event.velocity}`);
  }
});

// Safe SysEx send
midi.sendSysex([0xF0, 0x00, 0x20, 0x29, 0x02, 0x0C, 0xF7]);

// Emergency All Notes Off (CC 123 + CC 120)
midi.allNotesOff([1, 2]); // specific channels, or omit for all 16 channels
```

## Testing Double (`@mrjoshida/synth-engine/testing`)

An in-memory Web MIDI test double is exported via the `./testing` subpath:

```typescript
import { installFakeMidi, FakeMidiAccess, FakeMIDIInput, FakeMIDIOutput } from "@mrjoshida/synth-engine/testing";

const input = new FakeMIDIInput("in-1", "Mock Launchpad X In");
const output = new FakeMIDIOutput("out-1", "Mock Launchpad X Out");

const { access, restore } = installFakeMidi(globalThis, {
  initialInputs: [input],
  initialOutputs: [output],
  sysexAllowed: true
});

// Emit incoming MIDI to listeners
input.emit(new Uint8Array([0x90, 60, 100]));

// Inspect sent MIDI
console.log(output.sentMessages);

// Restore original navigator.requestMIDIAccess
restore();
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

## Patches, Presets and Parameters (v0.4.0)

v0.4.0 introduces unified patch state management, full polyphony across synthesis engines, and parameter specification definitions.

### Parameter Inspection & UI Bindings

Inspect parameter metadata, ranges, display units, and engine compatibility:

```typescript
import { PARAM_SPECS, getParamSpecs, getParamSpec, clampParam } from "@mrjoshida/synth-engine";

// Get all parameters supported by the Pluck engine
const pluckSpecs = getParamSpecs("pluck");

// Look up a specific parameter spec
const cutoffSpec = getParamSpec("filter.frequency");
```

### Preset & Parameter Control on SynthEngine

```typescript
import { sharedSynthEngine } from "@mrjoshida/synth-engine";

// Load a preset by id
sharedSynthEngine.loadPreset("moog-sub-thunder");

// Get a deep copy of the current active patch
const currentPatch = sharedSynthEngine.getPatch();

// Update a parameter with automatic clamping and audio smoothing
sharedSynthEngine.setParam("filter.frequency", 1800);
```

### Sanitizing Untrusted Input

Safely sanitize user-supplied or network-loaded JSON patches against specifications:

```typescript
import { sanitizePatch } from "@mrjoshida/synth-engine";

const safePatch = sanitizePatch(untrustedInput);
if (safePatch) {
  sharedSynthEngine.loadPatch(safePatch);
}
```

### Full Polyphony Across Engines

Voices for `pluck`, `moog`, `drone`, and `membrane` now use dynamic voice pooling (`VoiceAllocator`) supporting chords and multi-finger polyphony up to 12 voices each.
