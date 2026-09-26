import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      testing: "src/testing/index.ts"
    },
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["tone", "@mrjoshida/music-theory"]
  },
  {
    entry: { "synth-engine": "src/index.ts" },
    format: ["iife"],
    globalName: "SynthEngineModule",
    sourcemap: true,
    clean: false,
    external: ["tone"]
  }
]);
