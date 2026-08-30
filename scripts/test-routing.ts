/**
 * Standalone check for lib/routing.ts — no test runner, no React, just node.
 *   npm run test:routing
 *
 * Routes between landmarks at calm tide and at the storm peak, in both risk
 * modes, and asserts the properties the demo depends on.
 */

import {
  simulateAllSteps,
  worstCaseThroughHorizon,
  STEP_HOURS,
  STEP_COUNT,
  hoursToStep,
} from "../lib/flood";
import {
  graph,
  landmarks,
  findRoute,
  blockedEdgeIds,
  cutOffLandmarks,
  isEdgeBlocked,
  type RiskTolerance,
  type RouteResult,
} from "../lib/routing";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;

console.log(
  `\nGraph: ${graph.nodes.length} nodes, ${graph.edges.length} segments, ` +
    `${landmarks.length} landmarks`,
);
console.log(
  `Segment length: ${km(Math.min(...graph.edges.map((e) => e.lengthM)))} .. ` +
    `${km(Math.max(...graph.edges.map((e) => e.lengthM)))}\n`,
);

const states = simulateAllSteps();

const HORIZON_H = 12;
const lm = (id: string) => landmarks.find((l) => l.id === id)!;

function route(
  fromId: string,
  toId: string,
  step: number,
  mode: RiskTolerance,
): RouteResult {
  return findRoute(lm(fromId).nodeId, lm(toId).nodeId, {
    current: states[step],
    horizon: worstCaseThroughHorizon(states, step, HORIZON_H),
    mode,
    horizonH: HORIZON_H,
    timeline: states,
    startStep: step,
    stepHours: STEP_HOURS,
  });
}

function describe(label: string, r: RouteResult) {
  if (r.ok) {
    console.log(
      `  ${label.padEnd(34)} ${km(r.distanceM).padStart(8)}  ` +
        `${r.etaMinutes.toFixed(0).padStart(3)} min  ` +
        `${String(r.blockedEdges).padStart(3)} blocked  ` +
        `${r.warnings.length} warning(s)`,
    );
    for (const w of r.warnings) console.log(`      ! ${w.message}`);
  } else {
    console.log(`  ${label.padEnd(34)} NO ROUTE (${r.reason})`);
    console.log(`      ${r.message}`);
    if (r.nearestReachable) {
      console.log(
        `      -> nearest reachable: ${r.nearestReachable.landmark.name} ` +
          `(${km(r.nearestReachable.distanceM)})`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Segment closures over time
// ---------------------------------------------------------------------------

console.log("Road closures over the window");
console.log("  hour   level   blocked / total   cut-off landmarks");
console.log("  " + "-".repeat(60));

const stride = Math.round(3 / STEP_HOURS);
const ferryNode = lm("ferry").nodeId;
for (let i = 0; i < STEP_COUNT; i += stride) {
  const blocked = blockedEdgeIds(states[i]);
  const cut = cutOffLandmarks(ferryNode, states[i]);
  console.log(
    `  ${states[i].hours.toFixed(0).padStart(4)}  ` +
      `${states[i].waterLevelM.toFixed(2).padStart(6)}  ` +
      `${String(blocked.length).padStart(9)} / ${graph.edges.length}   ` +
      `${cut.map((c) => c.name).join(", ") || "none"}`,
  );
}

// ---------------------------------------------------------------------------
// Routes at calm tide vs. the storm peak
// ---------------------------------------------------------------------------

const CALM = hoursToStep(4);
const APPROACH = hoursToStep(20); // storm forecast, roads still open
const PEAK = states.reduce((a, b) => (b.waterLevelM > a.waterLevelM ? b : a)).index;

console.log(
  `
Routes at hour 4 (calm, ${states[CALM].waterLevelM.toFixed(2)} m)`,
);
describe("marina -> hospital  [fastest]", route("marina", "hospital", CALM, "fastest"));
describe("marina -> hospital  [safest]", route("marina", "hospital", CALM, "safest"));

console.log(
  `
Routes at hour 20 (surge forecast, ${states[APPROACH].waterLevelM.toFixed(2)} m) ` +
    `— this is the demo's money shot`,
);
const approachFastest = route("marina", "hospital", APPROACH, "fastest");
const approachSafest = route("marina", "hospital", APPROACH, "safest");
describe("marina -> hospital  [fastest]", approachFastest);
describe("marina -> hospital  [safest]", approachSafest);

console.log(
  `
Routes at hour ${states[PEAK].hours} (storm peak, ${states[PEAK].waterLevelM.toFixed(2)} m)`,
);
const peakFastest = route("marina", "hospital", PEAK, "fastest");
const peakSafest = route("marina", "hospital", PEAK, "safest");
describe("marina -> hospital  [fastest]", peakFastest);
describe("marina -> hospital  [safest]", peakSafest);
describe("ferry -> hospital  [fastest]", route("ferry", "hospital", PEAK, "fastest"));
describe("town-center -> shelter [safest]", route("town-center", "shelter", PEAK, "safest"));

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

console.log("\nAssertions");

// 1. Graph is one connected component when nothing is flooded.
const dryFrame = { flooded: new Uint8Array(states[0].flooded.length), waterLevelM: 0 };
check(
  "road network is fully connected when dry",
  cutOffLandmarks(ferryNode, dryFrame).length === 0,
  `${graph.nodes.length} nodes reachable`,
);

// 2. Calm conditions: every landmark pair is routable.
let allPairsOk = true;
const pairFailures: string[] = [];
for (const a of landmarks) {
  for (const b of landmarks) {
    if (a.id === b.id) continue;
    const r = route(a.id, b.id, CALM, "fastest");
    if (!r.ok) {
      allPairsOk = false;
      pairFailures.push(`${a.id}->${b.id}`);
    }
  }
}
check(
  "all landmark pairs routable at calm tide",
  allPairsOk,
  allPairsOk ? "20/20 pairs" : pairFailures.join(", "),
);

// 3. More flooding must mean at least as many closed segments.
const blockedCalm = blockedEdgeIds(states[CALM]).length;
const blockedPeak = blockedEdgeIds(states[PEAK]).length;
check(
  "the storm closes more roads than calm tide",
  blockedPeak > blockedCalm,
  `${blockedCalm} -> ${blockedPeak} of ${graph.edges.length} segments`,
);

// 4. A* optimality: the safest route can never be shorter than the fastest
//    one, because safest searches a strict subset of the same graph.
if (approachFastest.ok && approachSafest.ok) {
  check(
    "safest route is never shorter than fastest",
    approachSafest.distanceM >= approachFastest.distanceM - 1e-6,
    `fastest ${km(approachFastest.distanceM)} vs safest ${km(approachSafest.distanceM)}`,
  );
  check(
    "the two risk modes actually diverge before the surge arrives",
    approachSafest.distanceM > approachFastest.distanceM + 100,
    `safest detours ${km(approachSafest.distanceM - approachFastest.distanceM)} further`,
  );
  check(
    "fastest warns that its short route floods before you arrive",
    approachFastest.warnings.length > 0,
    `${approachFastest.warnings.length} segment(s) flagged`,
  );
  check(
    "safest route carries no flood warnings",
    approachSafest.warnings.length === 0,
  );
} else {
  check("both modes route from the marina during the approach", false);
}

// 4b. The causeway is the feature the whole demo turns on: open at calm tide,
//     gone at the peak, which is what forces the reroute.
const causeway = graph.edges.filter((e) => e.name === "Salt Flat Causeway");
const causewayLow = causeway.reduce((a, b) => (b.minElevation < a.minElevation ? b : a));
check(
  "Salt Flat Causeway is open at calm tide",
  !isEdgeBlocked(causewayLow, states[CALM]),
  `lowest point ${causewayLow.minElevation.toFixed(2)} m`,
);
check(
  "Salt Flat Causeway is impassable at the storm peak",
  isEdgeBlocked(causewayLow, states[PEAK]),
  `water ${states[PEAK].waterLevelM.toFixed(2)} m over a ${causewayLow.minElevation.toFixed(2)} m road bed`,
);
check(
  "both modes fall back to the Upper Ford Bridge at the peak",
  peakSafest.ok &&
    peakSafest.edgeIds.some(
      (id) => graph.edges.find((e) => e.id === id)!.name === "Upper Ford Bridge",
    ),
);

// 4c. The Ferry Dock is low enough to be cut off entirely — the router must
//     say so in plain language rather than returning a broken path.
const ferryPeak = route("ferry", "hospital", PEAK, "safest");
check(
  "the Ferry Dock is cut off at the peak, with an actionable message",
  !ferryPeak.ok && ferryPeak.reason === "origin-flooded",
  ferryPeak.ok ? "unexpectedly routed" : ferryPeak.message,
);

// 4d. When the DESTINATION is the thing that is cut off, the router must
//     suggest somewhere else worth driving to — not the place you are
//     already standing, and not the place it just told you is unreachable.
const toFerry = route("marina", "ferry", PEAK, "safest");
check(
  "an unreachable destination is reported as destination-flooded",
  !toFerry.ok && toFerry.reason === "destination-flooded",
  toFerry.ok ? "unexpectedly routed" : toFerry.message,
);
if (!toFerry.ok) {
  const suggested = toFerry.nearestReachable;
  check(
    "a reachable alternative is offered",
    !!suggested,
    suggested
      ? `${suggested.landmark.name} at ${km(suggested.distanceM)}`
      : "none offered",
  );
  check(
    "the alternative is neither the origin nor the failed destination",
    !!suggested &&
      suggested.landmark.id !== "marina" &&
      suggested.landmark.id !== "ferry",
    suggested?.landmark.id ?? "-",
  );
  check(
    "the message does not mention a zero-hour horizon",
    !toFerry.message.includes("0 h"),
    toFerry.message,
  );
}

// 4e. The arrival-window check: a segment that is open when you set off but
//     goes under before you are clear of it must be flagged. The whole
//     journey is shorter than one 15-minute timestep, so this only works
//     because the exposure window is rounded outwards rather than floored.
const onsetStep = hoursToStep(23.5);
const onsetRoute = findRoute(lm("shelter").nodeId, lm("town-center").nodeId, {
  current: states[onsetStep],
  horizon: worstCaseThroughHorizon(states, onsetStep, 6),
  mode: "fastest",
  horizonH: 6,
  timeline: states,
  startStep: onsetStep,
  stepHours: STEP_HOURS,
});
const onsetWarnings = onsetRoute.ok
  ? onsetRoute.warnings.filter((w) => /goes under while you are still on it/.test(w.message))
  : [];
check(
  "a road that floods mid-journey is flagged as such",
  onsetWarnings.length > 0,
  onsetWarnings[0]?.message ?? "no arrival-window warning fired",
);

// 5. A returned route must actually be passable end to end.
function routeIsClean(r: RouteResult, frame: { flooded: Uint8Array; waterLevelM: number }): boolean {
  if (!r.ok) return true;
  return r.edgeIds.every((id) => {
    const edge = graph.edges.find((e) => e.id === id)!;
    return !isEdgeBlocked(edge, frame);
  });
}
check(
  "fastest route uses no currently-flooded segment",
  routeIsClean(peakFastest, states[PEAK]),
);
check(
  "safest route uses no segment that floods before the horizon",
  routeIsClean(peakSafest, worstCaseThroughHorizon(states, PEAK, HORIZON_H)),
);

// 6. Routes must start and end where they were asked to.
if (peakFastest.ok) {
  check(
    "route endpoints match the request",
    peakFastest.nodes[0] === lm("marina").nodeId &&
      peakFastest.nodes[peakFastest.nodes.length - 1] === lm("hospital").nodeId,
  );
}

// 7. The no-route path must be a clean result, not a throw. Flood everything.
const allWet = {
  flooded: new Uint8Array(states[0].flooded.length).fill(1),
  waterLevelM: 99,
};
const stranded = findRoute(lm("marina").nodeId, lm("hospital").nodeId, {
  current: allWet,
  horizon: allWet,
  mode: "fastest",
  horizonH: HORIZON_H,
});
check(
  "total inundation returns a failure result rather than throwing",
  !stranded.ok && stranded.reason === "origin-flooded",
  stranded.ok ? "unexpectedly routed" : stranded.message,
);

// 8. Same-place routing is rejected cleanly.
const samePlace = findRoute(lm("ferry").nodeId, lm("ferry").nodeId, {
  current: states[CALM],
  horizon: states[CALM],
  mode: "fastest",
  horizonH: HORIZON_H,
});
check(
  "origin === destination is handled",
  !samePlace.ok && samePlace.reason === "same-place",
);

// 9. Performance: routing must be fast enough to run on every scrub frame.
const t0 = Date.now();
const ITER = 300;
for (let i = 0; i < ITER; i++) {
  route("marina", "hospital", PEAK, i % 2 ? "safest" : "fastest");
}
const perRoute = (Date.now() - t0) / ITER;
check(
  "a route recomputes in under 10 ms",
  perRoute < 10,
  `${perRoute.toFixed(2)} ms per route (incl. horizon mask union)`,
);

console.log(
  failures === 0 ? `\nAll checks passed.\n` : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
