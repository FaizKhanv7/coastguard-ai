/**
 * ============================================================================
 * CoastGuard AI - synthetic data generator
 * ============================================================================
 * Produces every input the demo needs as static files under `data/`, so the
 * app never touches a network API while it is being judged.
 *
 * Deterministic: everything is driven by one seeded PRNG (mulberry32), so
 * `npm run generate-data` reproduces byte-identical output.
 *
 * Outputs
 *   data/dem.json           elevation grid (metres relative to mean sea level)
 *   data/roads.json        road network (GeoJSON FeatureCollection), ~90 segments, one connected graph
 *   data/landmarks.json    5 named places pinned to road nodes
 *   data/forcing.json       48 h of tide + rainfall at 15-minute resolution
 *
 * The town, "Kalinaw Island", is fictional but sits on real coordinates
 * (9.8756 N, 126.0892 E) so the OpenStreetMap raster basemap has coverage.
 * ============================================================================
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEED = 20260830;

/** Bounding box of the town, ~4.4 km on a side. */
const BBOX = {
  lngMin: 126.0692,
  lngMax: 126.1092,
  latMin: 9.8556,
  latMax: 9.8956,
};

/** DEM resolution. 160x160 over 4.4 km gives ~27 m cells. */
const COLS = 160;
const ROWS = 160;

/** Forcing time series: 48 h at 15-minute steps. */
const STEP_MINUTES = 15;
const HOURS = 48;
const STEPS = (HOURS * 60) / STEP_MINUTES + 1; // 193 samples, inclusive

const OUT_DIR = join(process.cwd(), "data");

// ---------------------------------------------------------------------------
// Seeded PRNG + value noise
// ---------------------------------------------------------------------------

/** mulberry32 - small, fast, deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

/** Smootherstep, for noise interpolation without visible grid artefacts. */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Bilinear value noise on a periodic lattice. Cheap and good enough for
 * terrain texture - we are not trying to be geologically accurate.
 */
function makeValueNoise(random: () => number, size = 256) {
  const lattice = new Float64Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random();
  const at = (x: number, y: number) =>
    lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

  return function noise2(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const top = lerp(at(xi, yi), at(xi + 1, yi), tx);
    const bottom = lerp(at(xi, yi + 1), at(xi + 1, yi + 1), tx);
    return lerp(top, bottom, ty) * 2 - 1; // -1..1
  };
}

const noise2 = makeValueNoise(rand);

/** Fractional Brownian motion - stacked octaves of value noise. */
function fbm(x: number, y: number, octaves = 5, lacunarity = 2.1, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const EARTH_R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
function haversine(
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

/** Normalised grid coords (u = west to east, v = south to north), both 0..1. */
const uToLng = (u: number) => BBOX.lngMin + u * (BBOX.lngMax - BBOX.lngMin);
const vToLat = (v: number) => BBOX.latMin + v * (BBOX.latMax - BBOX.latMin);

/** Distance from point p to segment ab, all in normalised u/v space. */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Orientation sign of the triplet (a, b, c). */
const orient = (
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
) => Math.sign((by - ay) * (cx - bx) - (bx - ax) * (cy - by));

/** True if segments p1p2 and p3p4 properly cross. */
function segmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number],
): boolean {
  const d1 = orient(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  const d2 = orient(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1]);
  const d3 = orient(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1]);
  const d4 = orient(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1]);
  return d1 !== d2 && d3 !== d4;
}

function distToPolyline(px: number, py: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(
      px,
      py,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1],
    );
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/**
 * The shoreline, as the v-coordinate of the coast for a given u.
 * Ocean is everything north of this line (v > shoreV). A Gaussian notch
 * carves a bay southward into the middle of the town - that bay is what
 * makes the connectivity flood model interesting, because surge water
 * enters through it rather than uniformly along the coast.
 */
function shoreV(u: number): number {
  const wiggle = 0.055 * Math.sin(u * 6.1 + 0.7) + 0.03 * Math.sin(u * 13.7);
  const bay = 0.3 * Math.exp(-((u - 0.42) ** 2) / (2 * 0.085 ** 2));
  return 0.76 + wiggle - bay;
}

/** The tidal river, running from the inland hills down into the bay. */
const RIVER: [number, number][] = [
  [0.79, 0.06],
  [0.72, 0.16],
  [0.66, 0.25],
  [0.6, 0.31],
  [0.52, 0.36],
  [0.47, 0.42],
  [0.44, 0.5],
  [0.425, 0.56],
];

/** Old Quarry Basin - an inland bowl below sea level, ringed by high ground. */
const QUARRY = { u: 0.815, v: 0.33, radius: 0.055 };

/**
 * Salt Flat Causeway - a raised embankment carrying the direct road from the
 * town centre southeast to the hospital, crossing the tidal river on the way.
 *
 * This is the single most important feature for the demo. It is the SHORT way
 * to the hospital, so `fastest` always wants it, but it sits at only ~2.1 m,
 * so once the surge pushes the water past ~2.4 m it goes under and the only
 * remaining option is the long way round on the higher inland grid. That is
 * the divergence between the two routing modes, and it is also a clean
 * illustration of the connectivity model: the causeway floods because tidal
 * water backs *up the river channel* from the bay, not because rain fell on it.
 */
const CAUSEWAY: [number, number][] = [
  [0.395, 0.475],
  [0.46, 0.445],
  [0.535, 0.415],
  [0.61, 0.37],
  [0.672, 0.305],
];
const CAUSEWAY_ELEV = 2.1;
const CAUSEWAY_HALF_WIDTH = 0.016; // ~70 m, wide enough to survive 27 m cells

/**
 * Elevation in metres above mean sea level at normalised coords (u, v).
 *
 * Built as: a base ramp away from the shoreline, minus a broad harbour flat,
 * minus a carved river channel, plus fBm texture - then the quarry basin is
 * stamped in with a min(), which guarantees it sits below sea level while
 * its rim stays high.
 */
function elevationAt(u: number, v: number): number {
  const d = shoreV(u) - v; // >0 inland, <0 offshore

  let e: number;
  if (d >= 0) {
    // Inland: a broad, nearly flat coastal plain (the d^2.4 term stays small
    // for the first ~800 m) that only then steepens into hills. Roughly a
    // third of the land sits under 4 m, which is what makes a 2-3 m surge
    // genuinely dangerous rather than cosmetic.
    e = 55 * d ** 2.4 + 3.5 * (1 - Math.exp(-d / 0.1));
  } else {
    // Offshore: seabed drops away from the beach.
    e = -1.2 + 45 * d;
  }

  // Broad low-lying harbour flat around the town centre and bay head.
  // Modelled as a blend *towards* a low plateau rather than a subtraction,
  // so it flattens the terrain instead of digging a hole below sea level.
  const harbourDist = Math.hypot(u - 0.46, v - 0.47);
  e = lerp(e, 1.6, 0.85 * Math.exp(-(harbourDist ** 2) / (2 * 0.17 ** 2)));

  // A second low pocket behind the marina, on the west shore.
  const marinaDist = Math.hypot(u - 0.27, v - 0.53);
  e = lerp(e, 1.2, 0.7 * Math.exp(-(marinaDist ** 2) / (2 * 0.1 ** 2)));

  // Carve the river channel: deepest on the centreline, tapering out.
  const riverDist = distToPolyline(u, v, RIVER);
  if (riverDist < 0.035) {
    const falloff = 1 - riverDist / 0.035;
    e -= 5.2 * falloff * falloff;
  }

  // Terrain texture. Amplitude grows inland so the coastal plain stays flat
  // enough to flood convincingly while the hills look rugged.
  const texture = fbm(u * 7.5 + 11.3, v * 7.5 + 4.9);
  e += texture * (0.7 + Math.max(0, d) * 4);

  // Southeast ridge - the high ground the "safest" route escapes onto.
  const ridge =
    Math.exp(-((u - 0.82) ** 2) / (2 * 0.18 ** 2)) *
    Math.exp(-((v - 0.12) ** 2) / (2 * 0.22 ** 2));
  e += 26 * ridge;

  // Old Quarry Basin. Stamped last with min() so nothing fills it back in.
  // This is the case a naive "elevation < water level" model gets wrong:
  // the floor is below sea level but has no connection to the ocean.
  const qd = Math.hypot(u - QUARRY.u, v - QUARRY.v);
  if (qd < QUARRY.radius) {
    const t = qd / QUARRY.radius;
    e = Math.min(e, -2.0 + 14 * t * t);
  }

  // Salt Flat Causeway embankment. max() so it lifts the road bed over the
  // river channel and the salt flats without flattening the hills it runs
  // into at the eastern end.
  if (distToPolyline(u, v, CAUSEWAY) < CAUSEWAY_HALF_WIDTH) {
    e = Math.max(e, CAUSEWAY_ELEV);
  }

  return e;
}

// ---------------------------------------------------------------------------
// Build the DEM
// ---------------------------------------------------------------------------

function buildDem() {
  const elevations = new Array<number>(COLS * ROWS);
  let min = Infinity;
  let max = -Infinity;

  for (let row = 0; row < ROWS; row++) {
    // row 0 = southern edge (latMin), row ROWS-1 = northern edge (latMax)
    const v = row / (ROWS - 1);
    for (let col = 0; col < COLS; col++) {
      const u = col / (COLS - 1);
      const e = Math.round(elevationAt(u, v) * 100) / 100;
      elevations[row * COLS + col] = e;
      if (e < min) min = e;
      if (e > max) max = e;
    }
  }

  const cellSizeM =
    haversine(BBOX.lngMin, BBOX.latMin, BBOX.lngMax, BBOX.latMin) / (COLS - 1);

  return {
    name: "Kalinaw Island",
    description:
      "Synthetic DEM. Elevations are metres relative to mean sea level. " +
      "Row 0 is the southern edge (latMin); column 0 is the western edge " +
      "(lngMin). Row-major flattened array of length cols*rows.",
    bbox: BBOX,
    cols: COLS,
    rows: ROWS,
    cellSizeM: Math.round(cellSizeM * 100) / 100,
    minElevation: min,
    maxElevation: max,
    elevations,
  };
}

// ---------------------------------------------------------------------------
// Road network
// ---------------------------------------------------------------------------

type Node = { id: string; u: number; v: number; lng: number; lat: number };
type Edge = { from: string; to: string; name: string };

const ROAD_NAMES = [
  "Harbor Rd",
  "Marina Way",
  "Kalinaw High St",
  "Bayfront Ave",
  "Coral Lane",
  "Fishermans Walk",
  "East Cliff Path",
  "Mangrove Rd",
  "Quarry Rd",
  "Ridge Ave",
  "Palm Row",
  "Tide St",
  "Barangay Rd",
  "Old Ferry Rd",
  "Church Lane",
  "Sampaguita St",
  "Hillcrest Rd",
  "Banyan Ave",
  "Salt Flat Rd",
  "Windward St",
  "Leeward Lane",
  "Copra Rd",
  "Nipa St",
  "School Rd",
  "Clinic Way",
];

/**
 * Nudge a point inland until it sits on dry ground. Road nodes generated on
 * the grid can land in the bay; rather than deleting them (which fragments
 * the graph) we walk them south until they clear the waterline.
 */
function snapToLand(u: number, v: number, minElev = 1.0) {
  let vv = v;
  for (let i = 0; i < 120 && elevationAt(u, vv) < minElev; i++) {
    vv -= 0.006;
  }
  return { u, v: Math.max(0.03, vv) };
}

/**
 * True if a straight road between two points would have to cross the tidal
 * river. The river is the town's defining obstacle: the hospital and the
 * quarry sit on its eastern bank, everything else on the western one, and
 * there are exactly two ways over it — the low Salt Flat Causeway in the
 * middle of town and the Upper Ford Bridge far upstream on the ridge. That
 * is what forces `fastest` and `safest` to disagree once the causeway floods.
 */
function crossesRiver(a: Node, b: Node): boolean {
  const p1: [number, number] = [a.u, a.v];
  const p2: [number, number] = [b.u, b.v];
  for (let i = 0; i < RIVER.length - 1; i++) {
    if (segmentsIntersect(p1, p2, RIVER[i], RIVER[i + 1])) return true;
  }
  return false;
}

function buildRoads() {
  const nodes: Node[] = [];
  const nodeIndex = new Map<string, Node>();

  const GRID_COLS = 8;
  const GRID_ROWS = 7;
  const grid: Node[][] = [];

  // 1. Lay a jittered lattice of intersections over the land area.
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowNodes: Node[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const baseU = 0.08 + (c / (GRID_COLS - 1)) * 0.84;
      const baseV = 0.08 + (r / (GRID_ROWS - 1)) * 0.62;
      const ju = baseU + (rand() - 0.5) * 0.045;
      const jv = baseV + (rand() - 0.5) * 0.04;
      const snapped = snapToLand(ju, jv);
      const id = `n${r}_${c}`;
      const node: Node = {
        id,
        u: snapped.u,
        v: snapped.v,
        lng: uToLng(snapped.u),
        lat: vToLat(snapped.v),
      };
      nodes.push(node);
      nodeIndex.set(id, node);
      rowNodes.push(node);
    }
    grid.push(rowNodes);
  }

  // 2. Connect lattice neighbours, dropping a few links for irregularity.
  const edges: Edge[] = [];
  let nameIdx = 0;
  const nextName = () => ROAD_NAMES[nameIdx++ % ROAD_NAMES.length];

  const addEdge = (a: Node, b: Node, name?: string) => {
    edges.push({ from: a.id, to: b.id, name: name ?? nextName() });
  };

  let droppedCount = 0;
  let riverBlocked = 0;

  /** Add a lattice link unless it would ford the river. */
  const addLatticeEdge = (a: Node, b: Node, name: string) => {
    if (crossesRiver(a, b)) {
      riverBlocked++;
      return;
    }
    addEdge(a, b, name);
  };

  for (let r = 0; r < GRID_ROWS; r++) {
    const rowName = nextName();
    for (let c = 0; c < GRID_COLS - 1; c++) {
      // Drop ~12% of horizontal links so the grid does not look synthetic.
      if (rand() < 0.12) {
        droppedCount++;
        continue;
      }
      addLatticeEdge(grid[r][c], grid[r][c + 1], rowName);
    }
  }
  for (let c = 0; c < GRID_COLS; c++) {
    const colName = nextName();
    for (let r = 0; r < GRID_ROWS - 1; r++) {
      if (rand() < 0.12) {
        droppedCount++;
        continue;
      }
      addLatticeEdge(grid[r][c], grid[r + 1][c], colName);
    }
  }

  // 3. A couple of diagonal shortcuts, which give A* something to choose.
  addLatticeEdge(grid[1][1], grid[2][2], "Copra Cut");
  addLatticeEdge(grid[4][5], grid[5][6], "Ridge Shortcut");
  addLatticeEdge(grid[3][2], grid[4][3], "Mill Diagonal");

  // 3a. The Upper Ford Bridge — the high crossing, far upstream on the ridge.
  //     It never floods, but reaching it from town is a long way round.
  addEdge(grid[0][5], grid[0][6], "Upper Ford Bridge");

  // 3b. The Salt Flat Causeway: a chain of nodes along the embankment,
  //     stitched into the lattice at both ends. This is the low, direct route
  //     to the hospital that the surge takes away.
  const nearestLattice = (u: number, v: number, pool: Node[]) =>
    pool.reduce((best, n) =>
      Math.hypot(n.u - u, n.v - v) < Math.hypot(best.u - u, best.v - v)
        ? n
        : best,
    );

  const latticeSoFar = [...nodes];
  const causewayNodes: Node[] = CAUSEWAY.map((pt, i) => {
    const node: Node = {
      id: `cw${i}`,
      u: pt[0],
      v: pt[1],
      lng: uToLng(pt[0]),
      lat: vToLat(pt[1]),
    };
    nodes.push(node);
    nodeIndex.set(node.id, node);
    return node;
  });

  for (let i = 0; i < causewayNodes.length - 1; i++) {
    addEdge(causewayNodes[i], causewayNodes[i + 1], "Salt Flat Causeway");
  }
  // Tie both ends into the grid, each to the nearest intersection on its own
  // bank — the causeway is the crossing, so its approach roads must not be.
  const west = causewayNodes[0];
  const east = causewayNodes[causewayNodes.length - 1];
  const sameBank = (n: Node) => latticeSoFar.filter((c) => !crossesRiver(n, c));
  addEdge(west, nearestLattice(west.u, west.v, sameBank(west)), "Salt Flat Causeway");
  addEdge(east, nearestLattice(east.u, east.v, sameBank(east)), "Salt Flat Causeway");

  /** Nodes unreachable from nodes[0] over the current edge set. */
  const findOrphans = (): Node[] => {
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
    }
    const seen = new Set<string>([nodes[0].id]);
    const queue = [nodes[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur)!) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    return nodes.filter((n) => !seen.has(n.id));
  };

  // 4. Repair connectivity: any dropped link that isolated part of the graph
  //    gets replaced by a link to the nearest reachable node.
  let orphans = findOrphans();
  let guard = 0;
  while (orphans.length && guard++ < 40) {
    const orphan = orphans[0];
    const orphanIds = new Set(orphans.map((o) => o.id));
    const connected = nodes.filter((n) => !orphanIds.has(n.id));
    // Prefer a repair link that stays on this side of the river, so the
    // repair pass cannot quietly reintroduce a third crossing and undo the
    // two-bridges-only geography above.
    const sameSide = connected.filter((n) => !crossesRiver(orphan, n));
    const pool = sameSide.length ? sameSide : connected;
    let best = pool[0];
    let bestD = Infinity;
    for (const n of pool) {
      const d = Math.hypot(n.u - orphan.u, n.v - orphan.v);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    addEdge(orphan, best, "Link Rd");
    orphans = findOrphans();
  }

  // 5. Landmarks, each attached to the lattice by two short spurs so no
  //    landmark is a dead end that one flooded segment cuts off trivially.
  //
  //    `minElev` is the ground the landmark must stand on. The waterfront
  //    places are deliberately kept just above the normal high-tide range
  //    (~1.4 m) so they are usable day to day but go under in the surge —
  //    a ferry dock that is cut off at hour zero makes for a poor demo and
  //    a poor ferry dock.
  const landmarkSpecs = [
    {
      id: "hospital",
      name: "Kalinaw District Hospital",
      kind: "hospital",
      u: 0.735,
      v: 0.215,
      minElev: 8,
    },
    {
      id: "shelter",
      name: "Bayanihan School & Shelter",
      kind: "shelter",
      u: 0.205,
      v: 0.3,
      minElev: 8,
    },
    {
      id: "town-center",
      name: "Town Center Plaza",
      kind: "town-center",
      u: 0.5,
      v: 0.44,
      minElev: 3.2,
    },
    {
      id: "marina",
      name: "Kalinaw Marina",
      kind: "marina",
      u: 0.285,
      v: 0.545,
      // Sits on the raised west quay, above the surge, so it stays usable as
      // an origin all the way through the storm.
      minElev: 4.5,
      // Explicit link to the causeway's western end rather than leaving it to
      // the nearest-neighbour heuristic: this is the whole demo. It gives the
      // marina a SHORT way to the hospital that goes under in the surge,
      // alongside its LONG way round over the Upper Ford Bridge that does not.
      connectTo: ["cw0"],
    },
    {
      id: "ferry",
      name: "Ferry Dock",
      kind: "ferry",
      u: 0.395,
      v: 0.565,
      minElev: 2.4,
    },
  ];

  const latticeNodes = [...nodes];

  /** Lowest ground a straight spur between two points would cross. */
  const minElevAlong = (a: Node, b: Node) => {
    let lowest = Infinity;
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const e = elevationAt(a.u + (b.u - a.u) * t, a.v + (b.v - a.v) * t);
      if (e < lowest) lowest = e;
    }
    return lowest;
  };

  const landmarks = landmarkSpecs.map((spec) => {
    const snapped = snapToLand(spec.u, spec.v, spec.minElev);
    const node: Node = {
      id: `lm_${spec.id}`,
      u: snapped.u,
      v: snapped.v,
      lng: uToLng(snapped.u),
      lat: vToLat(snapped.v),
    };
    nodes.push(node);
    nodeIndex.set(node.id, node);

    // Two spurs, chosen for different reasons:
    //   - the NEAREST intersection, which is the road people actually use;
    //   - the one whose spur stays on the HIGHEST ground, which is the road
    //     that is still there in a surge.
    // Picking both purely by distance tends to run every access road through
    // the same low dip, which severs the landmark at the first high tide and
    // leaves the router with no alternative to offer.
    const candidates = latticeNodes
      .filter((n) => !crossesRiver(node, n))
      .map((n) => ({ n, d: Math.hypot(n.u - node.u, n.v - node.v) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map((c) => ({ ...c, low: minElevAlong(node, c.n) }));

    const nearest = candidates[0];
    const highest = [...candidates].sort((a, b) => b.low - a.low)[0];

    addEdge(node, nearest.n, `${spec.name} Access`);
    if (highest.n.id !== nearest.n.id) {
      addEdge(node, highest.n, `${spec.name} Ridge Access`);
    }

    // Any explicitly requested links (see the note on Town Center Plaza).
    for (const targetId of (spec as { connectTo?: string[] }).connectTo ?? []) {
      const target = nodeIndex.get(targetId);
      if (target) addEdge(node, target, "Salt Flat Causeway");
    }

    return {
      ...spec,
      nodeId: node.id,
      lng: node.lng,
      lat: node.lat,
      elevation: Math.round(elevationAt(node.u, node.v) * 100) / 100,
    };
  });

  // 6. Emit as GeoJSON. Segments get an interior point with a slight
  //    perpendicular bow, so sampling elevation along an edge is meaningful
  //    rather than just interpolating between two endpoints.
  const features = edges.map((e, i) => {
    const a = nodeIndex.get(e.from)!;
    const b = nodeIndex.get(e.to)!;
    // Causeway segments must stay dead straight, or the bow would carry the
    // road polyline off the narrow embankment corridor and it would sample
    // the river channel underneath instead of the road bed.
    const bow = e.name === "Salt Flat Causeway" ? 0 : (rand() - 0.5) * 0.1;
    const midU = (a.u + b.u) / 2 + -(b.v - a.v) * bow;
    const midV = (a.v + b.v) / 2 + (b.u - a.u) * bow;

    const coords: [number, number][] = (
      [
        [a.lng, a.lat],
        [uToLng(midU), vToLat(midV)],
        [b.lng, b.lat],
      ] as [number, number][]
    ).map(
      ([lng, lat]) =>
        [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as [
          number,
          number,
        ],
    );

    let lengthM = 0;
    for (let k = 0; k < coords.length - 1; k++) {
      lengthM += haversine(
        coords[k][0],
        coords[k][1],
        coords[k + 1][0],
        coords[k + 1][1],
      );
    }

    return {
      type: "Feature" as const,
      id: i,
      properties: {
        id: `seg${i}`,
        name: e.name,
        from: e.from,
        to: e.to,
        lengthM: Math.round(lengthM * 10) / 10,
        // Nominal free-flow speed; used for ETA only.
        speedKph: e.name.includes("Access") ? 25 : 40,
      },
      geometry: { type: "LineString" as const, coordinates: coords },
    };
  });

  return {
    riverBlocked,
    roads: { type: "FeatureCollection" as const, features },
    landmarks: {
      type: "FeatureCollection" as const,
      features: landmarks.map((lm) => ({
        type: "Feature" as const,
        properties: {
          id: lm.id,
          name: lm.name,
          kind: lm.kind,
          nodeId: lm.nodeId,
          elevation: lm.elevation,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [
            Math.round(lm.lng * 1e6) / 1e6,
            Math.round(lm.lat * 1e6) / 1e6,
          ],
        },
      })),
    },
    nodeCount: nodes.length,
    edgeCount: edges.length,
    droppedCount,
    landmarkSummary: landmarks.map((l) => `${l.name} @ ${l.elevation} m`),
  };
}

// ---------------------------------------------------------------------------
// Tide + rainfall forcing
// ---------------------------------------------------------------------------

/**
 * 48 hours of tide and rainfall.
 *
 *  tide     M2 (12.42 h) principal lunar semidiurnal constituent plus a
 *           smaller S2 (12.00 h) solar one. The two beat against each other,
 *           which is why successive high tides are not identical.
 *  surge    a Gaussian storm surge peaking at hour 26 - the demo's crisis.
 *  rainfall a baseline drizzle plus a heavy burst that leads the surge by
 *           ~2.5 h, mimicking a storm's rain band arriving ahead of the peak.
 */
function buildForcing() {
  const samples = [];
  for (let i = 0; i < STEPS; i++) {
    const hours = (i * STEP_MINUTES) / 60;

    const m2 = 1.1 * Math.sin((2 * Math.PI * hours) / 12.42 - 0.6);
    const s2 = 0.28 * Math.sin((2 * Math.PI * hours) / 12.0 + 1.1);
    const tide = m2 + s2;

    const surge = 2.35 * Math.exp(-((hours - 26) ** 2) / (2 * 4.6 ** 2));

    const burst = 46 * Math.exp(-((hours - 23.5) ** 2) / (2 * 3.1 ** 2));
    const early = 7 * Math.exp(-((hours - 12) ** 2) / (2 * 2.2 ** 2));
    const rainfallMmHr = Math.max(0, 1.2 + burst + early);

    samples.push({
      index: i,
      hours: Math.round(hours * 100) / 100,
      tideM: Math.round(tide * 1000) / 1000,
      surgeM: Math.round(surge * 1000) / 1000,
      rainfallMmHr: Math.round(rainfallMmHr * 100) / 100,
      windKph:
        Math.round(
          (12 + 58 * Math.exp(-((hours - 25) ** 2) / (2 * 5.5 ** 2))) * 10,
        ) / 10,
    });
  }

  return {
    description:
      "48 h of tide, storm surge and rainfall at 15-minute resolution. " +
      "tideM and surgeM are metres relative to mean sea level; they are " +
      "additive. rainfallMmHr is the instantaneous rate, which lib/flood.ts " +
      "integrates into an accumulation term with drainage decay.",
    startIso: "2026-09-14T00:00:00Z",
    stepMinutes: STEP_MINUTES,
    steps: STEPS,
    stormPeakHour: 26,
    samples,
  };
}

// ---------------------------------------------------------------------------
// Write everything out
// ---------------------------------------------------------------------------

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const dem = buildDem();
  const { roads, landmarks, nodeCount, edgeCount, droppedCount, landmarkSummary, riverBlocked } =
    buildRoads();
  const forcing = buildForcing();

  writeFileSync(join(OUT_DIR, "dem.json"), JSON.stringify(dem));
  writeFileSync(join(OUT_DIR, "roads.json"), JSON.stringify(roads, null, 1));
  writeFileSync(
    join(OUT_DIR, "landmarks.json"),
    JSON.stringify(landmarks, null, 1),
  );
  writeFileSync(join(OUT_DIR, "forcing.json"), JSON.stringify(forcing));

  // Summary, so regenerating gives a quick sanity read.
  const land = dem.elevations.filter((e) => e > 0).length;
  const low = dem.elevations.filter((e) => e > 0 && e < 3).length;
  console.log("CoastGuard AI - data generated");
  console.log(`  seed              ${SEED}`);
  console.log(`  DEM               ${COLS}x${ROWS} @ ${dem.cellSizeM} m/cell`);
  console.log(
    `  elevation range   ${dem.minElevation.toFixed(1)} m .. ${dem.maxElevation.toFixed(1)} m`,
  );
  console.log(
    `  land fraction     ${((land / dem.elevations.length) * 100).toFixed(1)}%`,
  );
  console.log(
    `  low-lying land    ${((low / land) * 100).toFixed(1)}% of land below 3 m`,
  );
  console.log(`  road nodes        ${nodeCount}`);
  console.log(`  road segments     ${edgeCount} (${droppedCount} dropped, ${riverBlocked} blocked by river)`);
  console.log(`  landmarks         ${landmarks.features.length}`);
  for (const s of landmarkSummary) console.log(`    - ${s}`);
  console.log(`  forcing samples   ${forcing.steps} (${HOURS} h)`);
}

main();
