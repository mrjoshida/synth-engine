# Microtonal Support — Design Notes & Future Work

## Current Approach (v0.1.x)

The `@mrjoshida/synth-engine` achieves microtonal-adjacent ambient textures using
standard 12-TET pitch classes combined with Tone.js audio-level techniques:

### Techniques Used

1. **Fat Oscillator Unison Spread** (`fatsaw`, `fattriangle`)
   - Presets like `poly-microtonal-haze` use `count: 5, spread: 40` to stack
     slightly-detuned oscillator copies, creating natural beating frequencies
     that approximate microtonal interval colors.

2. **Chorus Modulation**
   - Heavy chorus wet (0.4–0.6) applies slow pitch modulation that drifts
     notes away from strict 12-TET tuning, producing organic shimmer.

3. **FM Synthesis Inharmonic Ratios**
   - Presets like `fm-ambient-shimmer` use non-integer harmonicity ratios
     (e.g., 5.5:1) that generate inharmonic overtone spectra resembling
     non-Western tuning systems.

### Limitations

- **No true alternate tuning systems**: All pitch input is 12-TET.
  The `@mrjoshida/music-theory` package assumes 12 semitones/octave
  throughout its scale degree math and frequency calculations.
- **No per-note cent offsets**: Individual notes cannot be microtonally
  retuned (e.g., A4 = 432 Hz, or quarter-tone flats).
- **No Scala (.scl) support**: Cannot load external tuning definition files.

## Future Work (v0.2.x+)

Full microtonal support would require changes across two packages:

### `@mrjoshida/music-theory`
- Add `TuningSystem` type supporting EDO (equal divisions of octave),
  just intonation, Pythagorean, and custom cent tables.
- Add `ScalaTuning` loader for `.scl` / `.kbm` file parsing.
- Update `pitchToFrequency()` to accept a `TuningSystem` parameter.
- Update scale degree functions to work with non-12 divisions.

### `@mrjoshida/synth-engine`
- Add per-voice `detune(cents: number)` method using `Tone.js` detune param.
- Add `setTuningTable(table: Map<string, number>)` to `SynthEngine` for
  remapping pitch names to arbitrary frequencies.
- Create `MicrotonalVoice` that accepts frequency input directly
  (bypassing note-name-based triggering).
- Add microtonal preset category with tuning metadata.

### References
- [Scala tuning file format](https://www.huygens-fokker.org/scala/scl_format.html)
- [Tone.js detune parameter](https://tonejs.github.io/docs/15.0.4/Synth#detune)
- [Xenharmonic Wiki — EDO tunings](https://en.xen.wiki/w/EDO)
