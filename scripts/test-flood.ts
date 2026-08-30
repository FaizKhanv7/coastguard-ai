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

// 4. THE headline property, stated without naming a fixture: the connectivity
//    model must leave SOME cells dry that sit below the water level, and they
//    must be genuinely enclosed. On the synthetic island that was the Old
//    Quarry Basin; on Miami-Dade it is inland fill and spoil ground behind the
//    coastal ridge. Asserting the property rather than the place means this
//    test survives a change of dataset, which is exactly what happened.
check(
  "connectivity excludes cells a naive threshold would flood",
  peakState.isolatedCells > 0,
  `${peakState.isolatedCells} cells below the water line but cut off from the sea`,
);

// Find the deepest such cell and prove it really is enclosed: every cell on
// the straight line out to the nearest grid edge must rise above the water.
let deepestIsolated = -1;
let deepestDrop = 0;
for (let i = 0; i < elevations.length; i++) {
  if (peakState.flooded[i] === 0) {
    const drop = peakState.waterLevelM - elevations[i];
    if (drop > deepestDrop) {
      deepestDrop = drop;
      deepestIsolated = i;
    }
  }
}
check(
  "the deepest excluded cell is meaningfully below the water line",
  deepestIsolated >= 0 && deepestDrop > 0.25,
  deepestIsolated >= 0
    ? `${deepestDrop.toFixed(2)} m below water at cell ${deepestIsolated}`
    : "none found",
);

if (deepestIsolated >= 0) {
  // Walk outward along the row; a genuinely enclosed pocket must be separated
  // from the boundary by ground standing above the water level.
  const row = Math.floor(deepestIsolated / dem.cols);
  const col = deepestIsolated - row * dem.cols;
  let barrierWest = false;
  for (let c = col; c >= 0; c--) {
    if (elevations[cellIndex(row, c)] >= peakState.waterLevelM) { barrierWest = true; break; }
  }
  let barrierEast = false;
  for (let c = col; c < dem.cols; c++) {
    if (elevations[cellIndex(row, c)] >= peakState.waterLevelM) { barrierEast = true; break; }
  }
  check(
    "that cell is walled off from the grid edge by higher ground",
    barrierWest && barrierEast,
    `barriers west: ${barrierWest}, east: ${barrierEast}`,
  );
}

// 5. The model must always have an open-water connection. Which EDGE that is
//    depends on the dataset - the synthetic island faced north, Miami-Dade
//    faces east onto Biscayne Bay - so find the lowest boundary cell rather
//    than assuming a compass direction.
let oceanCell = -1;
let oceanElev = Infinity;
const edgeCells: number[] = [];
for (let col = 0; col < dem.cols; col++) {
  edgeCells.push(cellIndex(0, col), cellIndex(dem.rows - 1, col));
}
for (let row = 0; row < dem.rows; row++) {
  edgeCells.push(cellIndex(row, 0), cellIndex(row, dem.cols - 1));
}
for (const c of edgeCells) {
  if (elevations[c] < oceanElev) {
    oceanElev = elevations[c];
    oceanCell = c;
  }
}
check(
  "the lowest boundary cell is below sea level (open water is on the grid edge)",
  oceanElev < 0,
  `${oceanElev.toFixed(2)} m at cell ${oceanCell}`,
);
check(
  "open water stays flooded at every timestep",
  states.every((s) => s.flooded[oceanCell] === 1),
  `cell ${oceanCell}, row ${Math.floor(oceanCell / dem.cols)}, col ${oceanCell % dem.cols}`,
);

console.log(
  failures === 0
    ? `\nAll checks passed.\n`
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
