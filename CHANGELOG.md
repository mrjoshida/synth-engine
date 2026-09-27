# Changelog

All notable changes to `@mrjoshida/synth-engine` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-27

### Added
- Parameter specification and validation module (`PARAM_SPECS`, `getParamSpec`, `getParamSpecs`, `getDefaultParam`, `clampParam`).
- Pure patch management utilities (`INIT_PATCH`, `FX_BASELINE`, `PATCH_SCHEMA_VERSION`, `clonePatch`, `getPatchParam`, `getEffectiveParam`, `setPatchParam`, `withEngineType`).
- Secure patch sanitization (`sanitizePatch`) protecting against malformed structures and prototype pollution.
- Dynamic polyphonic voice pooling for Pluck, Moog, Drone, and Membrane engines driven by internal `VoiceAllocator` (`PooledVoice`, up to 12 voices each).
- Live keyed note API on `BaseVoice` (`startNote`, `stopNote`).
- `SynthEngine.loadPreset(id)`, `SynthEngine.getPatch()`, `SynthEngine.getVoiceType()`, and `SynthEngine.setParam(path, value)`.
- Smooth audio parameter transitions with `rampTo` on `applyPatch` and `FxRack.setConfig`.
- FMVoice filter control matching patch filter specifications.
- A patch loaded or edited before `init()` is applied by `init()`.
- Legacy `triggerAttack` on pluck and membrane stays a one-shot.

### Changed
- Behavioral change: `noteOn`/`noteOff` without `voiceType` now use the loaded patch's voice instead of always "poly".
- Sampler built-in presets (`sampler-grand-piano`, `sampler-electric-piano`, `sampler-celesta`) envelope attack/decay updated from 0 to 0.001 to conform to the 0.001 min log scale parameter range (SamplerVoice ignores envelope so audible playback is unchanged).

### Fixed
- Presets using "fatsaw" (`poly-neon-sunrise`, `poly-microtonal-haze`) threw a Tone TypeError on load.
- Unison count/spread, filter rolloff and Q = 0 were ignored.
- Presets now sound the same whatever was loaded before: voices reset absent fields to engine defaults.
- Pooled voices: chords now sound on pluck/moog/drone/membrane (they played a single note before).

## [0.3.1] - 2026-09-27

### Changed
- `SynthEngine.init()` no longer calls `Tone.start()` when audio is already running. `Tone.start()` always calls `resume()`, so calling `unlock()` in a user gesture and then `init()` now makes one resume request instead of two.

## [0.3.0] - 2026-09-27

### Added
- `SynthEngine.init({ lookAhead })`: sets the Tone.js scheduling look-ahead in seconds. Use `0` for live play; Tone's default (0.1 s) delays every note triggered "now".
- `SynthEngine.init({ webMidi: false })`: skips the engine's own Web MIDI access request and its permission prompt, for host apps that manage Web MIDI themselves.
- Exported `SynthEngineInitOptions` type.

### Changed
- `SynthEngine.init()` is safe to call concurrently: callers share one in-flight initialization instead of building duplicate voice chains. A failed initialization can be retried, and `dispose()` allows a fresh `init()`.

## [0.2.1] - 2026-09-25

### Fixed
- WebMidiManager: Store a single bound `statechange` handler and detach it from previous `MIDIAccess` instance on re-initialization / sysex upgrade to prevent listener leaks and duplicate `refreshPorts()` calls.
- WebMidiManager: Guard input `midimessage` listener attachment to prevent duplicate event subscriptions on multiple `requestAccess` calls.

## [0.2.0] - 2026-09-25

### Added

#### S1: Sustained Notes on `SynthEngine`
- `SynthEngine.noteOn(note: number | string, velocity?: number, opts?: { voiceType?: SynthEngineType; channel?: number })`: Triggers note attack with explicit sustained hold, accepting MIDI note number (0–127) or pitch string (e.g. `"C4"`), clamped velocity (0–1), and forwarding to `WebMidiManager.sendNoteOn`. Documented caller responsibility for ref-counting duplicate `noteOn` calls on identical pitches.
- `SynthEngine.noteOff(note: number | string, opts?: { voiceType?: SynthEngineType; channel?: number })`: Releases sustained note, accepting MIDI note number or pitch string and forwarding to `WebMidiManager.sendNoteOff`.

#### S2: Voice Release & Panic
- `SynthEngine.releaseAll(time?: any)`: Releases sustained notes across all 7 synthesis engine voices (`polyVoice`, `fmVoice`, `pluckVoice`, `moogVoice`, `droneVoice`, `membraneVoice`, `samplerVoice`).
- `SynthEngine.panic()`: Immediately silences all synth voices using `Tone.now()` and calls `WebMidiManager.allNotesOff()` on the active MIDI output.

#### S3: Audio Context Lifecycle Management
- `SynthEngine.init(opts?: { latencyHint?: AudioContextLatencyCategory | number })`: Configures Tone audio context with optional latency hint (e.g. `'interactive'`, `'playback'`, `'balanced'`, or numeric seconds) before starting context.
- `SynthEngine.unlock(): Promise<boolean>`: Resumes Tone context from user interaction gesture; resolves `true` when context is `'running'`.
- `SynthEngine.resume(): Promise<void>`: Resumes suspended audio context.
- `SynthEngine.getAudioState(): 'suspended' | 'running' | 'closed' | 'interrupted'`: Returns current Web Audio context state.
- `SynthEngine.onAudioStateChange(callback): () => void`: Subscribes to context `statechange` events; returns unsubscribe cleanup function.

#### S4: Web MIDI Enhancements
- `parseMidiMessage(data: Uint8Array | number[], timeStamp?: number, portId?: string): ParsedMidiEvent`: Pure MIDI status byte parser table handling Note On (normalizing velocity 0 to Note Off), Note Off, Control Change (0xB0), Polyphonic Key Pressure (0xA0), Channel Pressure (0xD0), System Exclusive (0xF0), and other realtime/system messages.
- `WebMidiManager.requestAccess(opts?: { sysex?: boolean })`: Requests Web MIDI access with automatic fallback to non-sysex access if sysex permission is rejected.
- `WebMidiManager.sendSysex(bytes: number[] | Uint8Array, portId?: string): boolean`: Safe SysEx dispatch checking `sysexEnabled` status before transmitting.
- `WebMidiManager.setPortFilter(predicate: ((device: MidiDevice) => boolean) | null)`: Filters enumerated output ports while preserving direct addressing via `sendTo()`.
- `WebMidiManager.onPortsChanged(callback): () => void`: Multi-listener port change subscription returning unsubscribe cleanup function.
- `WebMidiManager.allNotesOff(channels?: number | number[], portId?: string)`: Transmits CC 123 (All Notes Off, value 0) and CC 120 (All Sound Off, value 0) across specified channels (defaults to all 16 channels).
- `WebMidiManager.onMessage(callback): () => void`: Dispatches parsed incoming MIDI events from selected input port.
- `WebMidiManager.isAvailable(): boolean`: Returns whether Web MIDI is initialized and available.

#### S5: Fake MIDI Test Double
- Exported `./testing` subpath targeting in-memory Web MIDI test double:
  - `FakeMIDIPort`: Base class implementing `EventTarget`, device lifecycle, and open/close states.
  - `FakeMIDIInput`: Simulates MIDI input with `emit(data, timeStamp)` dispatching `MIDIMessageEvent`.
  - `FakeMIDIOutput`: Simulates MIDI output recording transmitted messages in `sentMessages`.
  - `FakeMidiAccess`: In-memory `MIDIAccess` implementation supporting dynamic port connect/disconnect and sysex configuration.
  - `installFakeMidi(target?, options?)`: Installs test double onto `navigator.requestMIDIAccess` with custom options and provides `restore()` cleanup.

### Fixed
- Reattach `midimessage` event listener when a selected MIDI input port is disconnected and reconnected (hot-plug robustness).
- Avoid attaching `AudioContext` `statechange` listener during `SynthEngine.init()` when zero subscribers are registered.
