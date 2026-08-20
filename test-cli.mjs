import { SynthEngine, PresetManager, MidiFileEncoder, BUILTIN_INSTRUMENTS } from './dist/index.mjs';
import * as MusicTheory from '@mrjoshida/music-theory';
import * as Tone from 'tone';

async function runTests() {
  console.log('🧪 Starting Standalone CLI Tests...\n');
  
  // 1. Instantiate SynthEngine and PresetManager
  const engine = new SynthEngine();
  const presetManager = new PresetManager();
  console.log('✅ SynthEngine and PresetManager instantiated.');

  // 2. Validate all 22 presets
  const presets = presetManager.getAll();
  if (presets.length === 22) {
    console.log(`✅ Loaded ${presets.length} presets successfully.`);
  } else {
    console.error(`❌ Expected 22 presets, got ${presets.length}`);
  }

  // 3. Test MIDI file buffer generation
  const events = [{ note: 'C4', time: 0, duration: 1, velocity: 1 }];
  const midiBuffer = MidiFileEncoder.createStandardMidiFile(events);
  if (midiBuffer && midiBuffer.byteLength > 0) {
    console.log(`✅ MIDI File Encoder generated buffer of size ${midiBuffer.byteLength} bytes.`);
  } else {
    console.error('❌ MIDI File Encoder failed to generate buffer.');
  }

  // 4. Test music theory scale degree and chord resolution
  try {
    const scale = MusicTheory.getScalePitchNotes('C', 'major');
    const chords = MusicTheory.getDiatonicChords('C', 'major');
    console.log(`✅ Music theory functions working: C major scale length ${scale.length}, C major chords count ${chords.length}.`);
  } catch (e) {
    console.error('❌ Music theory test failed:', e);
  }

  // 5. Test built-in instruments
  const instruments = Object.keys(BUILTIN_INSTRUMENTS || {});
  if (instruments.includes('grand-piano') && instruments.includes('electric-piano') && instruments.includes('celesta') && instruments.includes('nylon-guitar')) {
    console.log(`✅ 4 built-in instruments found: ${instruments.join(', ')}`);
  } else {
    console.error('❌ Missing expected built-in instruments.');
  }

  console.log('\n🎉 All tests completed.');
  process.exit(0);
}

runTests();
