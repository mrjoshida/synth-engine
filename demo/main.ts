import {
  SynthEngine,
  SynthEngineType,
  BUILTIN_SYNTH_PRESETS,
  BUILTIN_INSTRUMENTS,
  SynthPatch,
} from "../src/index";

const engine = new SynthEngine();

// --- Init ---
const btnInit = document.getElementById("btn-init") as HTMLButtonElement;
const initBanner = document.getElementById("init-banner") as HTMLDivElement;
const app = document.getElementById("app") as HTMLDivElement;

btnInit.addEventListener("click", async () => {
  await engine.init();
  initBanner.classList.add("hidden");
  app.classList.remove("hidden");
  populatePresets();
  populateInstruments();
  buildPiano();
  setupFxControls();
  setupTransport();
  checkMidi();
});

// --- Presets ---
function populatePresets() {
  const select = document.getElementById("preset-select") as HTMLSelectElement;
  const desc = document.getElementById("preset-desc") as HTMLSpanElement;

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- Select Preset --";
  select.appendChild(defaultOpt);

  const categories = new Map<string, SynthPatch[]>();
  BUILTIN_SYNTH_PRESETS.forEach(p => {
    if (!categories.has(p.category)) categories.set(p.category, []);
    categories.get(p.category)!.push(p);
  });

  categories.forEach((patches, cat) => {
    const group = document.createElement("optgroup");
    group.label = cat.charAt(0).toUpperCase() + cat.slice(1);
    patches.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.engineType})`;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });

  select.addEventListener("change", () => {
    const patch = engine.presets.getById(select.value);
    if (patch) {
      engine.loadPatch(patch);
      desc.textContent = patch.description || "";
    }
  });
}

// --- Voice Tester ---
const voiceTypes: SynthEngineType[] = ["poly", "fm", "pluck", "moog", "drone", "membrane"];
const voiceRow = document.getElementById("voice-buttons")!;

voiceTypes.forEach(vt => {
  const btnNote = document.createElement("button");
  btnNote.className = "btn";
  btnNote.textContent = `${vt} ♪ C4`;
  btnNote.addEventListener("click", () => engine.playNote("C4", "8n", 0.8, vt));
  voiceRow.appendChild(btnNote);

  if (vt !== "drone" && vt !== "membrane") {
    const btnChord = document.createElement("button");
    btnChord.className = "btn";
    btnChord.textContent = `${vt} Am`;
    btnChord.addEventListener("click", () => engine.playChord(["A3", "C4", "E4"], "2n", 0.8, vt));
    voiceRow.appendChild(btnChord);
  }
});

// --- Sampler ---
function populateInstruments() {
  const select = document.getElementById("instrument-select") as HTMLSelectElement;
  Object.entries(BUILTIN_INSTRUMENTS).forEach(([id, config]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = config.name;
    select.appendChild(opt);
  });

  const status = document.getElementById("instrument-status") as HTMLSpanElement;
  const btnLoad = document.getElementById("btn-load-instrument") as HTMLButtonElement;
  const btnPlay = document.getElementById("btn-play-sampler") as HTMLButtonElement;

  btnLoad.addEventListener("click", async () => {
    const id = select.value;
    status.textContent = "Loading...";
    btnPlay.disabled = true;
    try {
      await engine.loadInstrument(id);
      status.textContent = `Loaded: ${BUILTIN_INSTRUMENTS[id].name}`;
      btnPlay.disabled = false;
    } catch (e: any) {
      status.textContent = `Error: ${e.message}`;
    }
  });

  btnPlay.addEventListener("click", () => {
    engine.playNote("C4", "4n", 0.8, "sampler");
  });
}

// --- Piano ---
function buildPiano() {
  const piano = document.getElementById("piano")!;
  const notes = ["C", "D", "E", "F", "G", "A", "B"];
  const sharps = new Set(["C", "D", "F", "G", "A"]);

  for (let octave = 3; octave <= 4; octave++) {
    notes.forEach(note => {
      const key = document.createElement("div");
      key.className = "white-key";
      key.textContent = `${note}${octave}`;
      key.addEventListener("mousedown", () => {
        engine.playNote(`${note}${octave}`, "8n", 0.8);
        key.classList.add("active");
        setTimeout(() => key.classList.remove("active"), 200);
      });
      piano.appendChild(key);

      if (sharps.has(note)) {
        const black = document.createElement("div");
        black.className = "black-key";
        const sharpNote = `${note}#${octave}`;
        black.addEventListener("mousedown", () => {
          engine.playNote(sharpNote, "8n", 0.8);
          black.classList.add("active");
          setTimeout(() => black.classList.remove("active"), 200);
        });
        piano.appendChild(black);
      }
    });
  }

  // Final C5 key
  const c5 = document.createElement("div");
  c5.className = "white-key";
  c5.textContent = "C5";
  c5.addEventListener("mousedown", () => {
    engine.playNote("C5", "8n", 0.8);
    c5.classList.add("active");
    setTimeout(() => c5.classList.remove("active"), 200);
  });
  piano.appendChild(c5);
}

// --- FX ---
function setupFxControls() {
  const sliders: [string, string][] = [
    ["fx-reverb", "reverbWet"],
    ["fx-chorus", "chorusWet"],
    ["fx-delay", "delayWet"],
    ["fx-master", "masterVolume"],
  ];

  sliders.forEach(([id, param]) => {
    const slider = document.getElementById(id) as HTMLInputElement;
    const valSpan = document.getElementById(`${id}-val`) as HTMLSpanElement;
    slider.addEventListener("input", () => {
      const val = parseInt(slider.value) / 100;
      valSpan.textContent = val.toFixed(2);
      engine.fxRack.setConfig({ [param]: val });
    });
  });
}

// --- Transport ---
function setupTransport() {
  document.getElementById("btn-start")!.addEventListener("click", () => engine.startTransport());
  document.getElementById("btn-stop")!.addEventListener("click", () => engine.stopTransport());
  const bpmInput = document.getElementById("bpm") as HTMLInputElement;
  bpmInput.addEventListener("change", () => engine.setBpm(parseInt(bpmInput.value)));
}

// --- MIDI ---
async function checkMidi() {
  const el = document.getElementById("midi-status")!;
  const devices = engine.webMidi.getDevices();
  if (devices.length > 0) {
    el.innerHTML = devices.map(d => `✅ ${d.name} (${d.state})`).join("<br>");
  } else {
    el.textContent = "No MIDI output devices detected.";
  }
}
