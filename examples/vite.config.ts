import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Runs the examples with the sources of the package: npm run examples
// DRAWIO_URL=https://test.draw.io/?dev=1 npm run examples uses another draw.io.
const editorUrl = process.env.DRAWIO_URL;
const entry = (editorUrl != null) ? "./dev-editor.tsx" : "../src/index.ts";

export default defineConfig({
  plugins: [react()],
  define: { __DRAWIO_URL__: JSON.stringify(editorUrl ?? null) },
  resolve: {
    alias: { "@drawio/react": fileURLToPath(new URL(entry, import.meta.url)) }
  }
});
