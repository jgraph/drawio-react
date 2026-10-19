import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Runs the examples with the sources of the package: npm run examples
// http://localhost:5173/?dev=1 uses the local draw.io at test.draw.io, and
// DRAWIO_URL=<editor URL> npm run examples any other draw.io.
export default defineConfig({
  plugins: [react()],
  define: { __DRAWIO_URL__: JSON.stringify(process.env.DRAWIO_URL ?? null) },
  resolve: {
    alias: { "@drawio/react": fileURLToPath(new URL("./dev-editor.tsx", import.meta.url)) }
  }
});
