// Builds the two scripts that run inside opaque-origin sandboxes as self-contained IIFEs:
// the stage agent (injected inline into figure pages) and the Node runtime worker.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = [
  { entry: "src/stage/agent.ts", name: "AnatomyStageAgent", file: "stage-agent.js" },
  { entry: "src/runtime/node-worker.ts", name: "AnatomyNodeWorker", file: "node-worker.js" },
];

for (const { entry, name, file } of ENTRIES) {
  await build({
    root: ROOT,
    configFile: false,
    publicDir: false,
    logLevel: "warn",
    build: {
      outDir: join(ROOT, "public/runtime"),
      emptyOutDir: false,
      minify: true,
      lib: { entry: join(ROOT, entry), name, formats: ["iife"], fileName: () => file },
    },
  });
  console.log(`built public/runtime/${file}`);
}
