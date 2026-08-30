/**
 * Standalone check for lib/routing.ts — no test runner, no React, just node.
 *   npm run test:routing
 *
 * These assertions are deliberately about PROPERTIES of the router rather than
 * about named places. An earlier version asserted things like "the Salt Flat
 * Causeway is impassable at the peak", which was true of the synthetic island
 * and meaningless the moment the dataset became Miami-Dade. Properties survive
 * a change of dataset; fixtures do not.
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

const states = simulateAllSteps();
const HORIZON_H = 12;

const PEAK = states.reduce((a, b) => (b.waterLevelM > a.waterLevelM ? b : a)).index;
const CALM = states.reduce((a, b) => (b.waterLevelM < a.waterLevelM ? b : a)).index;

/** Lowest-lying and highest landmark: the most flood-exposed origin/destination pair. */
const byElev = [...landmarks].sort((a, b) => a.elevation - b.elevation);
const LOW = byElev[0];
const HIGH = byElev[byElev.length - 1];

console.log(
  `\nGraph: ${graph.nodes.length} nodes, ${graph.edges.length} segments, ` +
    `${landmarks.length} landmarks`,
);
console.log(
  `Calm step ${CALM} (${states[CALM].waterLevelM.toFixed(2)} m), ` +
    `peak step ${PEAK} (${states[PEAK].waterLevelM.toFixed(2)} m)`,
);
console.log(`Exposed pair: ${LOW.name} (${LOW.elevation} m) -> ${HIGH.name} (${HIGH.elevation} m)\n`);

function route(
  fromId: string,
  toId: string,
  step: number,
  mode: RiskTolerance,
): RouteResult {
  const from = landmarks.find((l) => l.id === fromId)!;
  const to = landmarks.find((l) => l.id === toId)!;
  return findRoute(from.nodeId, to.nodeId, {
    current: states[step],
    horizon: worstCaseThroughHorizon(states, step, HORIZON_H),
    mode,
    horizonH: HORIZON_H,
    timeline: states,
    startStep: step,
    stepHours: STEP_HOURS,
  });
}

// ---------------------------------------------------------------------------
// Road closures over the window
// ---------------------------------------------------------------------------

console.log("Road closures over the window");
console.log("  hour   level   blocked / total   cut-off landmarks");
console.log("  " + "-".repeat(62));
const stride = Math.max(1, Math.round(6 / STEP_HOURS));
for (let i = 0; i < STEP_COUNT; i += stride) {
  const blocked = blockedEdgeIds(states[i]).length;
  const cut = cutOffLandmarks(LOW.nodeId, states[i]).length;
  console.log(
    `  ${states[i].hours.toFixed(0).padStart(4)}  ` +
      `${states[i].waterLevelM.toFixed(2).padStart(6)}  ` +
      `${String(blocked).padStart(9)} / ${graph.edges.length}   ${cut}`,
  );
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

console.log("\nAssertions");

// 1. The network must be one connected component when nothing is flooded.
const dryFrame = { flooded: new Uint8Array(states[0].flooded.length), waterLevelM: -999 };
check(
  "every landmark is reachable when the network is dry",
  cutOffLandmarks(LOW.nodeId, dryFrame).length === 0,
  `${landmarks.length} landmarks over ${graph.nodes.length} nodes`,
);

// 2. Calm conditions: every landmark pair routes.
const pairFailures: string[] = [];
for (const a of landmarks) {
  for (const b of landmarks) {
    if (a.id === b.id) continue;
    if (!route(a.id, b.id, CALM, "fastest").ok) pairFailures.push(`${a.id}->${b.id}`);
  }
}
const pairCount = landmarks.length * (landmarks.length - 1);
check(
  "all landmark pairs routable at the calmest moment",
  pairFailures.length === 0,
  pairFailures.length ? pairFailures.slice(0, 4).join(", ") : `${pairCount}/${pairCount} pairs`,
);

// 3. The storm must close strictly more roads than the calm baseline.
const blockedCalm = blockedEdgeIds(states[CALM]).length;
const blockedPeak = blockedEdgeIds(states[PEAK]).length;
check(
  "the storm closes more roads than the calm baseline",
  blockedPeak > blockedCalm,
  `${blockedCalm} -> ${blockedPeak} of ${graph.edges.length} segments`,
);

// 4. A* optimality and behaviour, scanned across every landmark pair rather
//    than one hand-picked route. The lowest landmark strands entirely during
//    the surge, so a single pair can easily never show a divergence even when
//    the router is working correctly.
let neverShorter = true;
let diverged = 0;
let warned = 0;
let firstDivergence = "";
const stepStride = Math.max(1, Math.round(3 / STEP_HOURS));
for (let step = 0; step < STEP_COUNT; step += stepStride) {
  for (const a of landmarks) {
    for (const b of landmarks) {
      if (a.id === b.id) continue;
      const f = route(a.id, b.id, step, "fastest");
      const s = route(a.id, b.id, step, "safest");
      if (!f.ok || !s.ok) continue;
      if (s.distanceM < f.distanceM - 1e-6) neverShorter = false;
      if (s.distanceM > f.distanceM + 100) {
        diverged++;
        if (!firstDivergence) {
          firstDivergence = `h${states[step].hours} ${a.id}->${b.id} ${km(f.distanceM)} vs ${km(s.distanceM)}`;
        }
      }
      if (f.warnings.length) warned++;
    }
  }
}
check("safest is never shorter than fastest", neverShorter);
check(
  "the two risk modes diverge somewhere in the window",
  diverged > 0,
  diverged ? `${diverged} pair-timesteps, first at ${firstDivergence}` : "never diverged",
);
check(
  "fastest raises flood warnings somewhere in the window",
  warned > 0,
  `${warned} pair-timesteps with warnings`,
);

// 5. A returned route must be passable end to end under its own rules.
const peakFastest = route(LOW.id, HIGH.id, PEAK, "fastest");
const peakSafest = route(LOW.id, HIGH.id, PEAK, "safest");
const clean = (r: RouteResult, frame: { flooded: Uint8Array; waterLevelM: number }) =>
  !r.ok || r.edgeIds.every((id) => !isEdgeBlocked(graph.edges.find((e) => e.id === id)!, frame));
check("fastest route uses no currently-flooded segment", clean(peakFastest, states[PEAK]));
check(
  "safest route uses no segment that floods before the horizon",
  clean(peakSafest, worstCaseThroughHorizon(states, PEAK, HORIZON_H)),
);

// 6. Endpoints must be what was asked for.
if (peakFastest.ok) {
  check(
    "route endpoints match the request",
    peakFastest.nodes[0] === LOW.nodeId &&
      peakFastest.nodes[peakFastest.nodes.length - 1] === HIGH.nodeId,
  );
}

// 7. No-route cases must return a result, never throw or return a partial path.
const allWet = {
  flooded: new Uint8Array(states[0].flooded.length).fill(1),
  waterLevelM: 999,
};
const stranded = findRoute(LOW.nodeId, HIGH.nodeId, {
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

const samePlace = findRoute(LOW.nodeId, LOW.nodeId, {
  current: states[CALM],
  horizon: states[CALM],
  mode: "fastest",
  horizonH: HORIZON_H,
});
check(
  "origin === destination is handled",
  !samePlace.ok && samePlace.reason === "same-place",
);

// 8. When a destination is cut off, the suggested alternative must be useful:
//    neither the place we failed to reach, nor the place we are standing in.
let sawDestinationCutOff = false;
for (let step = 0; step < STEP_COUNT && !sawDestinationCutOff; step++) {
  for (const dest of landmarks) {
    if (dest.id === LOW.id) continue;
    const r = route(LOW.id, dest.id, step, "safest");
    if (!r.ok && r.reason === "destination-flooded") {
      sawDestinationCutOff = true;
      check(
        "an unreachable destination suggests a genuinely different alternative",
        !r.nearestReachable ||
          (r.nearestReachable.landmark.id !== dest.id &&
            r.nearestReachable.landmark.id !== LOW.id),
        r.nearestReachable
          ? `${dest.name} cut off -> ${r.nearestReachable.landmark.name}`
          : `${dest.name} cut off, no alternative offered`,
      );
      check(
        "the message does not mention a zero-hour horizon",
        !r.message.includes("0 h"),
        r.message.slice(0, 80),
      );
      break;
    }
  }
}
if (!sawDestinationCutOff) {
  console.log("  SKIP  no destination is ever fully cut off in this dataset");
}

// 9. Performance: routing runs on every timeline scrub, so it has to be cheap
//    even on a real city-scale graph.
const t0 = Date.now();
const ITER = 100;
for (let i = 0; i < ITER; i++) {
  route(LOW.id, HIGH.id, PEAK, i % 2 ? "safest" : "fastest");
}
const perRoute = (Date.now() - t0) / ITER;
check(
  "a route recomputes fast enough to scrub smoothly",
  perRoute < 50,
  `${perRoute.toFixed(2)} ms per route over ${graph.edges.length} segments`,
);

console.log(
  failures === 0 ? `\nAll checks passed.\n` : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
