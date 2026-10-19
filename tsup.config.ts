import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  external: ["react"],
  // The component uses hooks and the DOM: a client component in React Server Components
  banner: { js: "\"use client\";" }
});
