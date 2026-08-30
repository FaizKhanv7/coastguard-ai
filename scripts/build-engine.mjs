/**
 * Bundles `lib/engine.ts` into `public/coastguard-engine.js` as a plain
 * `<script>`-loadable global.
 *
 * This is what makes the field app and the dashboard genuinely one product
 * rather than two lookalikes: `coastguard-ai.html` is a static page with no
 * build step of its own, so without a bundle it could only ever reimplement
 * the flood model — and a reimplementation drifts. Instead it loads the exact
 * same compiled module the Next.js app imports.
 *
 * Runs on `predev` and `prebuild` alongside the mobile sync.
 */

import { build } from "esbuild";
import { statSync, copyFileSync } from "node:fs";

const OUT = "public/coastguard-engine.js";

/*
 * A second copy lands next to `coastguard-ai.html` at the repo root, because
 * that file is often opened straight off disk with file:// while working on
 * it. The field app references the bundle relatively, so it resolves to the
 * repo-root copy over file:// and to the public/ copy when Next.js serves it
 * at /mobile.html. The root copy is generated, so it is gitignored.
 */
const ROOT_COPY = "coastguard-engine.js";

await build({
  entryPoints: ["lib/engine.ts"],
  bundle: true,
  format: "iife",
  globalName: "CoastGuard",
  outfile: OUT,
  platform: "browser",
  target: ["es2020"],
  minify: true,
  // The DEM, roads, landmarks and forcing series are imported as JSON and
  // inlined, so the field app carries its own copy of the town and needs no
  // network round-trip to start simulating.
  loader: { ".json": "json" },
  logLevel: "warning",
});

copyFileSync(OUT, ROOT_COPY);

const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(
  `build-engine: lib/engine.ts -> ${OUT} + ${ROOT_COPY} (${kb} kB, global CoastGuard)`,
);
