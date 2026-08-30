/**
 * Checks the grounded assistant — npm run test:assistant
 *
 * The assistant makes confident, specific claims about the town, so the thing
 * worth testing is that those claims are actually derived from the model and
 * change when the model changes. A bot that says the same reassuring thing at
 * calm tide and at the storm peak is worse than no bot.
 */

import { ask, SUGGESTIONS } from "../lib/assistant";
import { landmarks, hoursToStep, levelSeries, STEP_COUNT } from "../lib/engine";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const marina = landmarks.find((l) => l.id === "marina")!;
const ferry = landmarks.find((l) => l.id === "ferry")!;
const CALM = hoursToStep(4);
const PEAK = levelSeries.reduce((b, v, i) => (v > levelSeries[b] ? i : b), 0);

const calm = (q: string) =>
  ask(q, { step: CALM, horizonH: 0, mode: "fastest", originNodeId: marina.nodeId });
const peak = (q: string) =>
  ask(q, { step: PEAK, horizonH: 0, mode: "fastest", originNodeId: marina.nodeId });
const peakFromFerry = (q: string) =>
  ask(q, { step: PEAK, horizonH: 0, mode: "fastest", originNodeId: ferry.nodeId });

console.log(`\nCalm step ${CALM}, peak step ${PEAK} (${levelSeries[PEAK].toFixed(2)} m)\n`);
console.log("Assertions");

// --- It must actually change with conditions -------------------------------
const roadsCalm = calm("which roads are closed?");
const roadsPeak = peak("which roads are closed?");
check(
  "road answers differ between calm and peak",
  roadsCalm.text !== roadsPeak.text,
  `"${roadsCalm.text.slice(0, 46)}…" vs "${roadsPeak.text.slice(0, 46)}…"`,
);
check(
  "the peak answer reports more closures",
  Number(roadsPeak.text.match(/^(\d+)/)?.[1]) >
    Number(roadsCalm.text.match(/^(\d+)/)?.[1]),
);

// --- Routing questions run the router --------------------------------------
const reachCalm = calm("can I reach the hospital?");
check(
  "a reachable destination is answered with a real distance",
  /\d+(\.\d+)? km/.test(reachCalm.text) && reachCalm.text.startsWith("Yes"),
  reachCalm.text.slice(0, 70),
);
check("routing answers cite the router", /A\* router/.test(reachCalm.basis));

const strandedAnswer = peakFromFerry("can I reach the hospital?");
check(
  "a stranded origin is told so, not given a route",
  !strandedAnswer.text.startsWith("Yes") &&
    /water|shelter in place|under water/i.test(strandedAnswer.text),
  strandedAnswer.text.slice(0, 80),
);

// --- Evacuation ------------------------------------------------------------
const evac = calm("where should we evacuate to?");
check(
  "evacuation advice names a real shelter with a road distance",
  /by road/.test(evac.text) && /m above sea level/.test(evac.text),
  evac.text.slice(0, 70),
);
const evacStranded = peakFromFerry("where should we evacuate to?");
check(
  "a stranded origin is told to shelter in place",
  /shelter in place/i.test(evacStranded.text),
);

// --- Depth -----------------------------------------------------------------
const depthPeak = peak("is the ferry dock under water?");
check(
  "depth questions answer from the connectivity fill",
  /connectivity fill/.test(depthPeak.basis),
  depthPeak.text.slice(0, 70),
);

// --- Peak ------------------------------------------------------------------
const peakAnswer = calm("when does it peak?");
check(
  "the peak answer states the real peak level",
  peakAnswer.text.includes(levelSeries[PEAK].toFixed(2)),
  peakAnswer.text.slice(0, 80),
);
check(
  "counts are pluralised correctly",
  !/\b1 key locations\b/.test(peakAnswer.text) &&
    !/\b1 road segments\b/.test(peakAnswer.text),
  peakAnswer.text.slice(0, 90),
);

// --- Every answer must carry provenance ------------------------------------
const all = [...SUGGESTIONS, "what is the water level", "tell me a joke"].map(calm);
check(
  "every answer carries a basis",
  all.every((a) => a.basis.length > 0),
);
check(
  "every answer is non-empty",
  all.every((a) => a.text.trim().length > 20),
);
check(
  "an unrecognised question still returns live figures rather than nothing",
  /\d/.test(calm("tell me a joke").text),
  calm("tell me a joke").text.slice(0, 70),
);

// --- No crashes at the edges ----------------------------------------------
let threw = false;
try {
  ask("", { step: 0, horizonH: 0, mode: "safest", originNodeId: marina.nodeId });
  ask("???", { step: STEP_COUNT - 1, horizonH: 24, mode: "safest", originNodeId: marina.nodeId });
} catch {
  threw = true;
}
check("empty and edge-of-window questions do not throw", !threw);

console.log(
  failures === 0 ? `\nAll checks passed.\n` : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
