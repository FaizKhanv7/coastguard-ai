/**
 * Copies the mobile app into `public/` so Next.js serves it.
 *
 * `coastguard-ai.html` at the repo root stays the single source of truth —
 * that is the file the team edits. This script mirrors it to
 * `public/mobile.html`, which is what the dashboard's "Field app" button
 * links to. It runs automatically on `npm run dev` and `npm run build`
 * (see the `predev` / `prebuild` scripts), so the served copy can never
 * drift from the source.
 *
 * It is also the one place a chatbot key can enter the static file. By
 * default it does not: the served copy talks to `/api/chat`, which holds the
 * key server-side. Set `EMBED_GROQ_KEY_IN_MOBILE=true` in `.env.local` and
 * the key is written into the copy instead, for demoing the single file with
 * no server behind it. The source of truth is never touched either way.
 */

import { copyFileSync, mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "coastguard-ai.html");
const OUT_DIR = join(process.cwd(), "public");
const DEST = join(OUT_DIR, "mobile.html");
const ENV_FILE = join(process.cwd(), ".env.local");

/**
 * A deliberately small `.env` reader. This script runs before Next boots, so
 * Next's own loader is not available, and pulling in a dependency to parse
 * `KEY=value` would be worse than eight lines.
 */
function readEnvLocal() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

if (!existsSync(SOURCE)) {
  console.error(
    `sync-mobile: ${SOURCE} not found. The dashboard's "Field app" button will 404.`,
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(SOURCE, DEST);

const env = { ...readEnvLocal(), ...process.env };
const embed = String(env.EMBED_GROQ_KEY_IN_MOBILE || "").toLowerCase() === "true";
const key = env.GROQ_API_KEY || "";

if (embed && key) {
  const marker = /embeddedKey:\s*""\s*\/\* sync-mobile:key \*\//;
  const html = readFileSync(DEST, "utf8");
  if (!marker.test(html)) {
    console.error(
      "sync-mobile: could not find the embeddedKey marker in coastguard-ai.html — the key was NOT embedded.",
    );
    process.exit(1);
  }
  // JSON.stringify so a key containing a quote cannot break out of the string.
  writeFileSync(
    DEST,
    html.replace(marker, `embeddedKey: ${JSON.stringify(key)} /* sync-mobile:key */`),
    "utf8",
  );
  console.warn(
    "sync-mobile: WARNING — GROQ_API_KEY baked into public/mobile.html. Anyone who opens that file can read it. Do not deploy this build publicly.",
  );
} else if (embed && !key) {
  console.warn(
    "sync-mobile: EMBED_GROQ_KEY_IN_MOBILE is true but GROQ_API_KEY is empty — nothing embedded.",
  );
}

const kb = (statSync(DEST).size / 1024).toFixed(1);
console.log(
  `sync-mobile: coastguard-ai.html -> public/mobile.html (${kb} kB)` +
    (embed && key ? " [key embedded]" : " [chatbot via /api/chat]"),
);
