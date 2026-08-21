import { SamplerInstrumentConfig } from "../types";

export const BUILTIN_INSTRUMENTS: Record<string, SamplerInstrumentConfig> = {
  "grand-piano": {
    id: "grand-piano",
    name: "Grand Piano (Salamander C5)",
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    sampleMap: {
      "A1": "A1.mp3",
      "C3": "C3.mp3",
      "C4": "C4.mp3",
      "C5": "C5.mp3",
      "A5": "A5.mp3",
      "C7": "C7.mp3"
    },
    volume: 0
  },
  "electric-piano": {
    id: "electric-piano",
    name: "Casio Vintage Keyboard",
    baseUrl: "https://tonejs.github.io/audio/casio/",
    sampleMap: {
      "A1": "A1.mp3",
      "C2": "C2.mp3",
      "D2": "D2.mp3",
      "F2": "F2.mp3",
      "A2": "A2.mp3"
    },
    volume: -2
  },
  "celesta": {
    id: "celesta",
    name: "Glass Harmonica / Celesta",
    baseUrl: "https://tonejs.github.io/audio/berklee/",
    sampleMap: {
      "C4": "glass_harmonica_1.mp3",
      "G4": "glass_harmonica_2.mp3",
      "C5": "glass_harmonica_3.mp3"
    },
    volume: -3
  },
  "nylon-guitar": {
    id: "nylon-guitar",
    name: "Acoustic Guitar Strings",
    baseUrl: "https://tonejs.github.io/audio/berklee/",
    sampleMap: {
      "E2": "guitar_LowEstring1.mp3",
      "A2": "guitar_Astring.mp3",
      "D3": "guitar_Dstring.mp3",
      "G3": "guitar_Gstring.mp3",
      "B3": "guitar_Bstring.mp3",
      "E4": "guitar_highEstring.mp3"
    },
    volume: -1
  }
};
