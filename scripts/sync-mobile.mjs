/**
 * Copies the mobile app into `public/` so Next.js serves it.
 *
 * `coastguard-ai.html` at the repo root stays the single source of truth —
 * that is the file the team edits. This script mirrors it to
 * `public/mobile.html`, which is what the dashboard's "Mobile app" button
 * links to. It runs automatically on `npm run dev` and `npm run build`
 * (see the `predev` / `prebuild` scripts), so the served copy can never
 * drift from the source.
 */

import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "coastguard-ai.html");
const OUT_DIR = join(process.cwd(), "public");
const DEST = join(OUT_DIR, "mobile.html");

if (!existsSync(SOURCE)) {
  console.error(
    `sync-mobile: ${SOURCE} not found. The dashboard's "Mobile app" button will 404.`,
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(SOURCE, DEST);

const kb = (statSync(DEST).size / 1024).toFixed(1);
console.log(`sync-mobile: coastguard-ai.html -> public/mobile.html (${kb} kB)`);
