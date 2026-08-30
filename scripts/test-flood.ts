/**
 * Standalone check for lib/flood.ts — no test runner, no React, just node.
 *   npm run test:flood
 *
 * Prints the water level and flooded-cell count across the 48 h window, then
 * asserts the two properties the model exists to guarantee.
 */

import {
  simulateAllSteps,
  waterLevels,
  floodedLandFraction,
  STEP_HOURS,
  STEP_COUNT,
} from "../lib/flood";
import { dem, elevations, cellIndex } from "../lib/dem";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log(`\nDEM: ${dem.cols}x${dem.rows} @ ${dem.cellSizeM} m/cell`);
console.log(
  `Elevation ${dem.minElevation.toFixed(1)} m .. ${dem.maxElevation.toFixed(1)} m\n`,
);

const t0 = Date.now();
const states = simulateAllSteps();
const elapsed = Date.now() - t0;

console.log(
  `Simulated ${STEP_COUNT} timesteps in ${elapsed} ms ` +
    `(${(elapsed / STEP_COUNT).toFixed(1)} ms/step)\n`,
);

// ---------------------------------------------------------------------------
// Time series table — every 2 hours
// ---------------------------------------------------------------------------

console.log("  hour   tide   surge    rain    level   flooded   % land   cut off");
console.log("  " + "-".repeat(68));

const stride = Math.round(2 / STEP_HOURS);
for (let i = 0; i < STEP_COUNT; i += stride) {
  const s = states[i];
  const pct = (floodedLandFraction(s) * 100).toFixed(1);
  const bar = "#".repeat(Math.max(0, Math.round(s.waterLevelM * 6)));
  console.log(
    `  ${s.hours.toFixed(0).padStart(4)}  ` +
      `${s.tideM.toFixed(2).padStart(5)}  ` +
      `${s.surgeM.toFixed(2).padStart(5)}  ` +
      `${s.rainfallMmHr.toFixed(1).padStart(6)}  ` +
      `${s.waterLevelM.toFixed(2).padStart(6)}  ` +
      `${String(s.floodedCells).padStart(7)}  ` +
      `${pct.padStart(6)}  ` +
      `${String(s.isolatedCells).padStart(6)}  ${bar}`,
  );
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

console.log("\nAssertions");

// 1. Water level should peak during the storm, not at the start or end.
const peak = waterLevels.reduce((a, b) => (b.levelM > a.levelM ? b : a));
check(
  "water level peaks inside the storm window",
  peak.hours > 20 && peak.hours < 34,
  `peak ${peak.levelM.toFixed(2)} m at hour ${peak.hours}`,
);

// 2. Flooded area must grow into the storm and recede afterwards.
const calm = states[0];
const peakState = states[peak.index];
const late = states[STEP_COUNT - 1];
check(
  "flooding grows into the storm",
  peakState.floodedCells > calm.floodedCells * 1.05,
  `${calm.floodedCells} cells at h0 -> ${peakState.floodedCells} at peak`,
);
check(
  "flooding recedes after the storm",
  late.floodedCells < peakState.floodedCells,
  `${peakState.floodedCells} at peak -> ${late.floodedCells} at h48`,
);

// 3. Monotonicity: a higher water level can never flood fewer cells.
let monotonic = true;
for (let i = 0; i < STEP_COUNT; i++) {
  for (let j = 0; j < STEP_COUNT; j++) {
    if (
      states[i].waterLevelM > states[j].waterLevelM &&
      states[i].floodedCells < states[j].floodedCells
    ) {
      monotonic = false;
      break;
    }
  }
  if (!monotonic) break;
}
check("flooded area is monotonic in water level", monotonic);

// 4. THE headline property: the Old Quarry Basin sits below sea level but is
//    ringed by high ground, so connectivity must keep it dry even at the
//    storm peak. A naive elevation threshold would flood it.
const quarryCol = Math.round(0.815 * (dem.cols - 1));
const quarryRow = Math.round(0.33 * (dem.rows - 1));
const quarryIdx = cellIndex(quarryRow, quarryCol);
const quarryElev = elevations[quarryIdx];

check(
  "Old Quarry Basin floor is below sea level",
  quarryElev < 0,
  `${quarryElev.toFixed(2)} m`,
);
check(
  "connectivity keeps the quarry dry at the storm peak",
  peakState.flooded[quarryIdx] === 0,
  `water ${peakState.waterLevelM.toFixed(2)} m, quarry floor ${quarryElev.toFixed(2)} m`,
);
check(
  "a naive threshold model would wrongly flood it",
  quarryElev < peakState.waterLevelM && peakState.isolatedCells > 20,
  `${peakState.isolatedCells} cells below water level but cut off from the sea`,
);

// 5. Ocean cells on the north edge must always be flooded.
const northEdge = cellIndex(dem.rows - 1, Math.round(dem.cols / 2));
check(
  "open ocean is flooded at every timestep",
  states.every((s) => s.flooded[northEdge] === 1),
  "north edge midpoint",
);

console.log(
  failures === 0
    ? `\nAll checks passed.\n`
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
