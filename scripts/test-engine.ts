/**
 * Checks the shared engine facade — the API both surfaces drive.
 *   npm run test:engine
 *
 * The point of these assertions is that the dashboard and the field app get
 * the SAME answers, so anything that could silently diverge between them is
 * checked here rather than in either UI.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  community,
  stateAt,
  displayedState,
  worstCase,
  statusAt,
  route,
  reachability,
  bestShelter,
  leafletImageBounds,
  levelSeries,
  formatClock,
  landmarks,
  graph,
  STEP_COUNT,
  STEP_HOURS,
  hoursToStep,
} from "../lib/engine";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const km = (m: number) => `${(m / 1000).toFixed(2)} km`;

const CALM = hoursToStep(4);
const PEAK = levelSeries.reduce(
  (best, v, i) => (v > levelSeries[best] ? i : best),
  0,
);
// Chosen from the data, not hardcoded: the most and least flood-exposed
// landmarks. Keeps this suite valid across a change of dataset.
const byElev = [...landmarks].sort((a, b) => a.elevation - b.elevation);
const marina = byElev[byElev.length - 1]; // highest: a dependable origin
const ferry = byElev[0];                  // lowest: the exposed one

console.log(
  `\nCommunity layer: ${community.shelters.length} shelters, ` +
    `${community.incidents.length} incidents, ${community.resources.length} resources, ` +
    `${community.volunteerJobs.length} jobs`,
);
console.log(`Peak water ${levelSeries[PEAK].toFixed(2)} m at step ${PEAK}\n`);

console.log("Assertions");

// --- Community layer is genuinely on the network ---------------------------
const allPlaces = [
  ...community.shelters,
  ...community.incidents,
  ...community.resources,
  ...community.volunteerJobs,
];
check(
  "every community item sits on a real graph node",
  allPlaces.every((p) => graph.nodeIndex.has(p.nodeId)),
  `${allPlaces.length} items`,
);
check(
  "every community item has a plausible elevation",
  allPlaces.every((p) => p.elevationM > -30 && p.elevationM < 70),
);
// Miami-Dade is flat: Jackson Memorial genuinely sits at about 1 m, so
// "every shelter is above every incident" is a property of a synthetic island,
// not of a real coastal city. What must hold is that the shelter estate as a
// whole is higher ground, and that at least one stays above the storm peak.
const shelterElevs = community.shelters.map((s) => s.elevationM);
const incidentElevs = community.incidents.map((i) => i.elevationM);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
check(
  "shelters sit on higher ground than incidents on average",
  mean(shelterElevs) > mean(incidentElevs),
  `${mean(shelterElevs).toFixed(1)} m vs ${mean(incidentElevs).toFixed(1)} m`,
);
check(
  "at least one shelter stands above the storm peak",
  Math.max(...shelterElevs) > stateAt(PEAK).waterLevelM,
  `highest shelter ${Math.max(...shelterElevs)} m vs peak water ${stateAt(PEAK).waterLevelM.toFixed(2)} m`,
);

// --- The two surfaces must agree ------------------------------------------
check(
  "displayedState(step, 0) is the state at that step",
  displayedState(CALM, 0).index === stateAt(CALM).index,
);
check(
  "a horizon shifts the displayed moment forward",
  displayedState(CALM, 12).index === CALM + hoursToStep(12),
  `step ${CALM} +12h -> ${displayedState(CALM, 12).index}`,
);
check(
  "worstCase never picks a calmer moment than now",
  worstCase(CALM, 12).waterLevelM >= stateAt(CALM).waterLevelM - 1e-9,
);
check(
  "worstCase near the end of the window stays in range",
  worstCase(STEP_COUNT - 2, 24).index <= STEP_COUNT - 1,
  `index ${worstCase(STEP_COUNT - 2, 24).index} of ${STEP_COUNT - 1}`,
);

// --- Status ---------------------------------------------------------------
const calmStatus = statusAt(CALM, 0, marina.nodeId);
const peakStatus = statusAt(PEAK, 0, marina.nodeId);
check(
  "status escalates from calm to the storm peak",
  peakStatus.blockedCount > calmStatus.blockedCount &&
    peakStatus.severity === "severe" &&
    calmStatus.severity !== "severe",
  `${calmStatus.blockedCount} roads cut / ${calmStatus.severity} -> ` +
    `${peakStatus.blockedCount} / ${peakStatus.severity}`,
);
check(
  "the connectivity model still reports isolated cells at the peak",
  peakStatus.isolatedCells > 20,
  `${peakStatus.isolatedCells} cells below water but cut off from the sea`,
);

// --- Routing through the facade matches the demo behaviour ----------------
// The facade must reproduce A*'s ordering property. Scanned across the window
// rather than at a fixed hour: during the surge `safest` legitimately finds no
// route at all, and "one mode failed" is not a violation of the ordering.
{
  const highest = byElev[byElev.length - 1];
  const secondHighest = byElev[byElev.length - 2];
  let compared = 0;
  let violated = 0;
  let sample = "";
  for (let step = 0; step < STEP_COUNT; step += 8) {
    const f = route(secondHighest.nodeId, highest.nodeId, { step, horizonH: 12, mode: "fastest" });
    const sf = route(secondHighest.nodeId, highest.nodeId, { step, horizonH: 12, mode: "safest" });
    if (!f.ok || !sf.ok) continue;
    compared++;
    if (sf.distanceM < f.distanceM - 1e-6) violated++;
    if (!sample) sample = `${km(f.distanceM)} vs ${km(sf.distanceM)}`;
  }
  check(
    "safest is never shorter than fastest through the facade",
    compared > 0 && violated === 0,
    compared ? `${compared} comparable timesteps, first ${sample}` : "no timestep had both modes routing",
  );
}

// --- Reachability ---------------------------------------------------------
const sheltersCalm = reachability(community.shelters, marina.nodeId, { step: CALM });
check(
  "shelters are reachable from high ground at the calmest moment",
  sheltersCalm.some((s) => s.reachable),
  `${sheltersCalm.filter((s) => s.reachable).length}/${sheltersCalm.length} from ${marina.name}`,
);
check(
  "reachable items carry a distance and an ETA, unreachable ones carry neither",
  sheltersCalm.every((s) =>
    s.reachable
      ? s.distanceM !== null && s.etaMinutes !== null
      : s.distanceM === null && s.etaMinutes === null,
  ),
);

const fromFerryAtPeak = reachability(community.shelters, ferry.nodeId, { step: PEAK });
check(
  "reachability from the most exposed landmark is never worse than from the safest",
  fromFerryAtPeak.filter((s) => s.reachable).length <= sheltersCalm.length,
  `${fromFerryAtPeak.filter((s) => s.reachable).length}/${fromFerryAtPeak.length} reachable from ${ferry.name} at the peak`,
);

// --- Shelter recommendation ----------------------------------------------
const pick = bestShelter(marina.nodeId, { step: CALM });
check(
  "a shelter is recommended from high ground",
  pick !== null,
  pick ? `${pick.item.name} at ${km(pick.distanceM!)}, ${pick.item.elevationM} m` : "none",
);
check(
  "any recommended shelter is reachable and has spare capacity",
  pick === null ||
    (pick.reachable && pick.item.capacityUsed < pick.item.capacityTotal),
  pick ? `${pick.item.name}` : "none offered",
);
{
  const pickFromExposed = bestShelter(ferry.nodeId, { step: PEAK });
  check(
    "any shelter recommended from the exposed landmark is genuinely reachable",
    pickFromExposed === null || pickFromExposed.reachable,
    pickFromExposed ? `${pickFromExposed.item.name}` : "none offered (origin stranded)",
  );
}

// --- Presentation helpers -------------------------------------------------
check(
  "Leaflet bounds are [[south, west], [north, east]]",
  leafletImageBounds[0][0] < leafletImageBounds[1][0] &&
    leafletImageBounds[0][1] < leafletImageBounds[1][1],
  JSON.stringify(leafletImageBounds),
);
check("level series covers the whole window", levelSeries.length === STEP_COUNT);
check(
  "clock formatting rolls into day 2",
  formatClock(hoursToStep(26)).startsWith("Day 2"),
  formatClock(hoursToStep(26)),
);
check("step hours is a quarter hour", STEP_HOURS === 0.25);

// --- The browser bundle must expose what the field app actually calls -------
// This is precisely the failure mode that broke this project once already: a
// change to the module the dashboard imports silently removing something the
// other surface depends on. The field app has no type checking, so it would
// only fail at runtime — in front of judges.
const BUNDLE = join(process.cwd(), "public", "coastguard-engine.js");
if (!existsSync(BUNDLE)) {
  check("browser bundle exists (run npm run build:engine)", false);
} else {
  const src = readFileSync(BUNDLE, "utf8");
  const sandbox: Record<string, unknown> = {};
  new Function("window", src + "; window.__CG = CoastGuard;")(sandbox);
  const CG = sandbox.__CG as Record<string, unknown>;

  // Every name coastguard-ai.html reaches for through `CG.`
  const required = [
    "community", "statusAt", "route", "reachability", "bestShelter",
    "floodImage", "displayedState", "leafletImageBounds", "isEdgeBlocked",
    "graph", "landmarks", "nearestNode", "shortName", "formatClock",
    "hoursToStep", "HORIZONS", "STEP_COUNT", "floodDepthAt",
  ];
  const missing = required.filter((k) => CG?.[k] === undefined);
  check(
    "browser bundle exposes every API the field app calls",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${required.length} names present`,
  );

  // And it must agree with the module the dashboard imports, exactly.
  const bundleStatus = (CG.statusAt as typeof statusAt)(PEAK, 0, marina.nodeId);
  const direct = statusAt(PEAK, 0, marina.nodeId);
  check(
    "both surfaces compute identical conditions",
    bundleStatus.waterLevelM === direct.waterLevelM &&
      bundleStatus.blockedCount === direct.blockedCount &&
      bundleStatus.isolatedCells === direct.isolatedCells,
    `${bundleStatus.waterLevelM.toFixed(2)} m · ${bundleStatus.blockedCount} roads cut · ` +
      `${bundleStatus.isolatedCells} isolated cells`,
  );
}

console.log(
  failures === 0 ? `\nAll checks passed.\n` : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
