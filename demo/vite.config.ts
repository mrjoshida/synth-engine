import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      "@mrjoshida/music-theory": resolve(__dirname, "../../packages/music-theory/src/index.ts"),
    }
  },
  server: {
    port: 5174,
    open: true
  }
});
