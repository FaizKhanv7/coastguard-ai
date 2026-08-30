/**
 * ============================================================================
 * ALGORITHM 2 - Dynamic safe-route pathfinding
 * ============================================================================
 *
 * WHAT IT DOES
 * Finds the shortest still-passable route between two points on the road
 * network, where "passable" is decided by the flood model rather than by a
 * static map. As the projected water level changes, edges drop out of the
 * graph and the route is recomputed against what is left.
 *
 * HOW IT WORKS
 *
 * 1. Graph.  Nodes are road intersections, edges are the segments between
 *    them, and each edge's weight is its length in metres. The road GeoJSON
 *    already carries `from`/`to` node ids, so the graph is exact — no
 *    coordinate-snapping heuristics needed.
 *
 * 2. Elevation sampling.  At build time each edge is sampled every ~15 m and
 *    the DEM cell index for each sample is cached on the edge. Deciding
 *    whether an edge is flooded is then a handful of array lookups against a
 *    flood mask. Doing this once is what lets the timeline scrub smoothly.
 *
 *    A segment closes when any sampled point is standing in more than
 *    VEHICLE_DEPTH_LIMIT_M of water — not merely when it is wet. Roads get
 *    damp at every high tide; they stop being drivable at about 30 cm.
 *
 * 3. A*.  Standard A* over the passable subgraph, with a haversine
 *    straight-line heuristic. That heuristic is admissible because edge
 *    weights are ground distances, so it never overestimates the remaining
 *    cost and A* is guaranteed to return the true shortest path.
 *
 * 4. Risk tolerance.  Both modes minimise distance; they differ in which
 *    edges they are allowed to use.
 *      - `fastest`  excludes only edges flooded *right now*. Shorter, but it
 *                   may run through ground that is about to go under.
 *      - `safest`   excludes any edge flooded at *any* timestep between now
 *                   and the horizon — that is `worstCaseThroughHorizon` from
 *                   lib/flood.ts. Longer, but it will still be there when you
 *                   need it.
 *
 * 5. Arrival-window check.  We walk the path accumulating travel time and, for
 *    each segment, check every flood frame the interval you are on it touches.
 *    A segment that is open when you set off but goes under before you are
 *    clear of it gets flagged. Because the whole journey is shorter than one
 *    15-minute timestep, the window is rounded outwards rather than floored —
 *    flooring it would collapse onto the departure frame and the check could
 *    never fire.
 *
 * NO-ROUTE HANDLING
 * `findRoute` never throws. If the destination is unreachable it returns
 * `{ ok: false }` with a reason and, where it can, the nearest landmark that
 * *is* still reachable, so the UI can say "the hospital is cut off — nearest
 * open shelter is X" instead of showing an error.
 *
 * Everything here is a pure function. No React, no DOM.
 * ============================================================================
 */

import roadsJson from "../data/roads.json";
import landmarksJson from "../data/landmarks.json";
import { cellAt, haversine, elevations, isNoData } from "./dem";
import { waterLevels } from "./flood";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LngLat = [number, number];

export interface GraphNode {
  id: string;
  lng: number;
  lat: number;
  /** Indices into graph.edges. */
  edges: number[];
}

export interface GraphEdge {
  id: string;
  name: string;
  /** Indices into graph.nodes. */
  a: number;
  b: number;
  lengthM: number;
  speedKph: number;
  coordinates: LngLat[];
  /** DEM cell indices sampled along the segment, cached at build time. */
  sampleCells: Int32Array;
  /** Lowest elevation anywhere along the segment — handy for the UI. */
  minElevation: number;
  /** How the road is carried: on grade, on a bridge deck, or in a tunnel. */
  structure: "bridge" | "tunnel" | "grade";
  /**
   * Road surface elevation in metres. For a bridge this is the deck, taken
   * from the abutments rather than the DEM underneath — see the note in
   * isEdgeBlocked.
   */
  deckElevationM: number;
}

export interface RoadGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeIndex: Map<string, number>;
}

export interface Landmark {
  id: string;
  name: string;
  kind: string;
  nodeId: string;
  elevation: number;
  lng: number;
  lat: number;
}

export type RiskTolerance = "safest" | "fastest";
export type RescueVehicle = "standard-patrol" | "high-water" | "shallow-draft-vessel";

export interface RouteWarning {
  edgeId: string;
  roadName: string;
  /** Hours from the start of the journey at which you would reach it. */
  arrivalH: number;
  message: string;
}

export interface RouteSuccess {
  ok: true;
  mode: RiskTolerance;
  /** Node ids from origin to destination. */
  nodes: string[];
  edgeIds: string[];
  /** Full polyline, ready to hand to MapLibre. */
  coordinates: LngLat[];
  distanceM: number;
  etaMinutes: number;
  /** Segments the model says flood before you would get through them. */
  warnings: RouteWarning[];
  /** Number of graph edges A* was allowed to consider. */
  passableEdges: number;
  /** Number of graph edges excluded as flooded. */
  blockedEdges: number;
}

export interface RouteFailure {
  ok: false;
  mode: RiskTolerance;
  reason:
    | "no-route"
    | "origin-flooded"
    | "destination-flooded"
    | "same-place"
    | "unknown-place";
  message: string;
  /** Populated when we can suggest somewhere else to go. */
  nearestReachable?: {
    landmark: Landmark;
    distanceM: number;
    etaMinutes: number;
    coordinates: LngLat[];
  };
  blockedEdges: number;
}

export type RouteResult = RouteSuccess | RouteFailure;

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/** Spacing between elevation samples along an edge, in metres. */
const SAMPLE_SPACING_M = 15;

/**
 * Ground below this is permanently submerged and is therefore water, not road.
 *
 * The DEM is bare earth at ~40 m per cell, so a coastal road or a road running
 * beside a canal inevitably picks up cells that are actually the channel next
 * to it. Left in, those cells report the road as flooded at every state of the
 * tide - which is how 843 Miami road segments came out "impassable" at low
 * water. A cell that never emerges even at the lowest water level in the whole
 * forecast is not part of the carriageway, so it is dropped from the sample.
 */
const PERMANENT_WATER_M = Math.min(...waterLevels.map((w) => w.levelM));

interface RoadFeature {
  properties: {
    id: string;
    name: string;
    from: string;
    to: string;
    lengthM: number;
    speedKph: number;
    structure?: "bridge" | "tunnel" | "grade";
    deckElevationM?: number;
  };
  geometry: { type: "LineString"; coordinates: number[][] };
}

interface LandmarkFeature {
  properties: {
    id: string;
    name: string;
    kind: string;
    nodeId: string;
    elevation: number;
  };
  geometry: { type: "Point"; coordinates: number[] };
}

/**
 * Walks a segment's polyline at fixed spacing and returns the DEM cell index
 * at each sample. Duplicates are collapsed, since adjacent samples often land
 * in the same 27 m cell.
 */
function sampleEdgeCells(coords: LngLat[]): {
  cells: Int32Array;
  lengthM: number;
} {
  const seen = new Set<number>();
  let lengthM = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [aLng, aLat] = coords[i];
    const [bLng, bLat] = coords[i + 1];
    const segLen = haversine(aLng, aLat, bLng, bLat);
    lengthM += segLen;

    const steps = Math.max(1, Math.ceil(segLen / SAMPLE_SPACING_M));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cell = cellAt(aLng + (bLng - aLng) * t, aLat + (bLat - aLat) * t);
      // Skip anything that is not carriageway: USGS no-data (open water,
      // where 3DEP has no bare earth) and ground that never emerges even at
      // the lowest water level in the forecast.
      if (cell >= 0 && !isNoData(elevations[cell]) && elevations[cell] > PERMANENT_WATER_M) {
        seen.add(cell);
      }
    }
  }

  return { cells: Int32Array.from(seen), lengthM };
}

/** Builds the routing graph from the bundled road GeoJSON. Run once. */
export function buildGraph(): RoadGraph {
  const features = (roadsJson as unknown as { features: RoadFeature[] })
    .features;

  const nodes: GraphNode[] = [];
  const nodeIndex = new Map<string, number>();
  const edges: GraphEdge[] = [];

  const nodeFor = (id: string, lng: number, lat: number): number => {
    const existing = nodeIndex.get(id);
    if (existing !== undefined) return existing;
    const idx = nodes.length;
    nodes.push({ id, lng, lat, edges: [] });
    nodeIndex.set(id, idx);
    return idx;
  };

  for (const f of features) {
    const coords = f.geometry.coordinates as LngLat[];
    const start = coords[0];
    const end = coords[coords.length - 1];

    const a = nodeFor(f.properties.from, start[0], start[1]);
    const b = nodeFor(f.properties.to, end[0], end[1]);

    const { cells, lengthM } = sampleEdgeCells(coords);

    // Cheapest way to expose "how low does this road get" to the UI.
    let minElevation = Infinity;
    for (const c of cells) {
      if (elevations[c] < minElevation) minElevation = elevations[c];
    }

    const edgeIdx = edges.length;
    edges.push({
      id: f.properties.id,
      name: f.properties.name,
      a,
      b,
      lengthM: lengthM || f.properties.lengthM,
      speedKph: f.properties.speedKph,
      coordinates: coords,
      sampleCells: cells,
      minElevation,
      structure: f.properties.structure ?? "grade",
      deckElevationM: f.properties.deckElevationM ?? minElevation,
    });

    nodes[a].edges.push(edgeIdx);
    nodes[b].edges.push(edgeIdx);
  }

  return { nodes, edges, nodeIndex };
}

/** The bundled road graph. Built once at module load. */
export const graph: RoadGraph = buildGraph();

/** The five named places, with their attachment node in the graph. */
export const landmarks: Landmark[] = (
  landmarksJson as unknown as { features: LandmarkFeature[] }
).features.map((f) => ({
  id: f.properties.id,
  name: f.properties.name,
  kind: f.properties.kind,
  nodeId: f.properties.nodeId,
  elevation: f.properties.elevation,
  lng: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
}));

// ---------------------------------------------------------------------------
// Passability
// ---------------------------------------------------------------------------

/**
 * The minimum flood state a passability test needs: which cells are wet, and
 * how high the water is standing. `FloodState` from lib/flood.ts satisfies it.
 */
export interface FloodFrame {
  flooded: Uint8Array;
  waterLevelM: number;
}

/**
 * Depth of standing water at which a road stops being drivable, in metres.
 *
 * Miami coastal rescue defaults: 0.15 m for standard patrol vehicles and
 * 0.90 m for high-water vehicles. The route API selects the threshold from
 * the requested rescue vehicle profile.
 */
export const STANDARD_PATROL_DEPTH_LIMIT_M = 0.15;
export const HIGH_WATER_VEHICLE_DEPTH_LIMIT_M = 0.90;
export const SHALLOW_DRAFT_VESSEL_MIN_DEPTH_M = 0.60;
/** Backwards-compatible default: standard coastal patrol vehicle. */
export const VEHICLE_DEPTH_LIMIT_M = STANDARD_PATROL_DEPTH_LIMIT_M;

export function clearanceForVehicle(vehicle: RescueVehicle): number {
  if (vehicle === "high-water") return HIGH_WATER_VEHICLE_DEPTH_LIMIT_M;
  return STANDARD_PATROL_DEPTH_LIMIT_M;
}

/** A shallow-draft rescue vessel requires at least 0.60 m connected water depth. */
export function isShallowDraftNavigable(depthM: number): boolean {
  return depthM > SHALLOW_DRAFT_VESSEL_MIN_DEPTH_M;
}


/**
 * An edge is impassable if ANY sampled point along it is BOTH connected to the
 * flood AND standing in more than `depthLimit` of water.
 *
 * Deliberately strict about location: one impassable dip in the middle of a
 * road closes the whole segment, which is how road closures actually work.
 */
export function isEdgeBlocked(
  edge: GraphEdge,
  frame: FloodFrame,
  depthLimit: number = VEHICLE_DEPTH_LIMIT_M,
): boolean {
  /*
   * A bridge is judged against its deck, not against the DEM beneath it.
   *
   * The elevation model is bare earth: under a causeway it records the bay
   * floor. Sampling those cells would report every bridge in the county as
   * permanently submerged, sever the causeways at low tide, and make the whole
   * map wrong in a way that looks plausible. So for a bridge we compare the
   * water level to the deck estimated from its abutments.
   *
   * Tunnels get the opposite treatment: they sit below grade, so they flood
   * before the surface around them does.
   */
  if (edge.structure === "bridge") {
    return frame.waterLevelM - edge.deckElevationM > depthLimit;
  }

  // Every sample was open water (a causeway OSM never tagged as a bridge).
  // Judge it on its recorded bed elevation instead of calling it dry.
  if (edge.sampleCells.length === 0) {
    return frame.waterLevelM - edge.deckElevationM > depthLimit;
  }

  for (let i = 0; i < edge.sampleCells.length; i++) {
    const cell = edge.sampleCells[i];
    if (frame.flooded[cell] && frame.waterLevelM - elevations[cell] > depthLimit) {
      return true;
    }
  }
  return false;
}

/** Water depth over the lowest point of a segment — 0 if it is dry. */
export function edgeMaxDepth(edge: GraphEdge, frame: FloodFrame): number {
  let deepest = 0;
  for (let i = 0; i < edge.sampleCells.length; i++) {
    const cell = edge.sampleCells[i];
    if (frame.flooded[cell]) {
      const d = frame.waterLevelM - elevations[cell];
      if (d > deepest) deepest = d;
    }
  }
  return deepest;
}

/** Ids of every segment currently impassable — used by the status panel. */
export function blockedEdgeIds(frame: FloodFrame): string[] {
  const out: string[] = [];
  for (const e of graph.edges) {
    if (isEdgeBlocked(e, frame)) out.push(e.id);
  }
  return out;
}

/** Boolean-per-edge passability, indexed the same way as graph.edges. */
export function passableEdgeFlags(frame: FloodFrame, depthLimit: number = VEHICLE_DEPTH_LIMIT_M): Uint8Array {
  const flags = new Uint8Array(graph.edges.length);
  for (let i = 0; i < graph.edges.length; i++) {
    flags[i] = isEdgeBlocked(graph.edges[i], frame, depthLimit) ? 0 : 1;
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Binary min-heap, keyed on f-score
// ---------------------------------------------------------------------------

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];

  get size() {
    return this.items.length;
  }

  push(item: number, key: number) {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.keys.length && this.keys[l] < this.keys[smallest]) smallest = l;
        if (r < this.keys.length && this.keys[r] < this.keys[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(i: number, j: number) {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    [this.keys[i], this.keys[j]] = [this.keys[j], this.keys[i]];
  }
}

// ---------------------------------------------------------------------------
// A*
// ---------------------------------------------------------------------------

interface AStarResult {
  nodePath: number[];
  edgePath: number[];
  distanceM: number;
}

/**
 * A* from `startIdx` to `goalIdx` over edges whose flag is 1.
 * Returns null when no path exists.
 */
function aStar(
  startIdx: number,
  goalIdx: number,
  passable: Uint8Array,
): AStarResult | null {
  const { nodes, edges } = graph;
  const n = nodes.length;
  const goal = nodes[goalIdx];

  // Straight-line distance to the goal. Admissible: edge weights are ground
  // distances, so this can never overestimate the remaining cost.
  const heuristic = (i: number) =>
    haversine(nodes[i].lng, nodes[i].lat, goal.lng, goal.lat);

  const gScore = new Float64Array(n).fill(Infinity);
  const cameFromNode = new Int32Array(n).fill(-1);
  const cameFromEdge = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);

  gScore[startIdx] = 0;
  const open = new MinHeap();
  open.push(startIdx, heuristic(startIdx));

  while (open.size > 0) {
    const current = open.pop();
    if (current === goalIdx) break;
    if (closed[current]) continue;
    closed[current] = 1;

    for (const edgeIdx of nodes[current].edges) {
      if (!passable[edgeIdx]) continue;
      const edge = edges[edgeIdx];
      const next = edge.a === current ? edge.b : edge.a;
      if (closed[next]) continue;

      const tentative = gScore[current] + edge.lengthM;
      if (tentative < gScore[next]) {
        gScore[next] = tentative;
        cameFromNode[next] = current;
        cameFromEdge[next] = edgeIdx;
        open.push(next, tentative + heuristic(next));
      }
    }
  }

  if (gScore[goalIdx] === Infinity) return null;

  // Walk the parent pointers back to the start.
  const nodePath: number[] = [];
  const edgePath: number[] = [];
  let cur = goalIdx;
  while (cur !== -1) {
    nodePath.push(cur);
    const e = cameFromEdge[cur];
    if (e !== -1) edgePath.push(e);
    cur = cameFromNode[cur];
  }
  nodePath.reverse();
  edgePath.reverse();

  return { nodePath, edgePath, distanceM: gScore[goalIdx] };
}

// ---------------------------------------------------------------------------
// Route assembly
// ---------------------------------------------------------------------------

/**
 * Joins each edge's polyline into one continuous line from origin to
 * destination, flipping segments whose stored direction runs backwards.
 */
function stitchCoordinates(nodePath: number[], edgePath: number[]): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i < edgePath.length; i++) {
    const edge = graph.edges[edgePath[i]];
    const forward = edge.a === nodePath[i];
    const coords = forward ? edge.coordinates : [...edge.coordinates].reverse();
    // Skip the first point of every segment after the first, to avoid dupes.
    out.push(...(i === 0 ? coords : coords.slice(1)));
  }
  return out;
}

/** Travel time along a segment at its nominal free-flow speed, in hours. */
const edgeTravelHours = (edge: GraphEdge) =>
  edge.lengthM / 1000 / edge.speedKph;

export interface FindRouteOptions {
  /** The flood state right now. */
  current: FloodFrame;
  /**
   * The worst flood state between now and the horizon. Required for `safest`;
   * also used to generate warnings for `fastest`.
   */
  horizon: FloodFrame;
  mode: RiskTolerance;
  /** Hours the horizon frame covers — only used in warning text. */
  horizonH: number;
  /**
   * Per-timestep flood states, so we can check whether a segment is under
   * water at the moment you would actually reach it. Optional.
   */
  timeline?: FloodFrame[];
  /** Index into `timeline` the journey starts at. */
  startStep?: number;
  /** Hours per timeline step. */
  stepHours?: number;
  /** Vehicle clearance used for road passability. */
  vehicle?: RescueVehicle;
}

/**
 * Main entry point. Returns a discriminated union — never throws, never
 * returns a partial path.
 */
export function findRoute(
  originNodeId: string,
  destNodeId: string,
  opts: FindRouteOptions,
): RouteResult {
  const { mode, current, horizon, horizonH } = opts;
  const depthLimit = clearanceForVehicle(opts.vehicle ?? "standard-patrol");

  // `safest` avoids anything that floods before the horizon; `fastest` only
  // avoids what is under water at this moment.
  const routingFrame = mode === "safest" ? horizon : current;
  const passable = passableEdgeFlags(routingFrame, depthLimit);

  let blocked = 0;
  for (let i = 0; i < passable.length; i++) if (!passable[i]) blocked++;

  const startIdx = graph.nodeIndex.get(originNodeId);
  const goalIdx = graph.nodeIndex.get(destNodeId);

  if (startIdx === undefined || goalIdx === undefined) {
    return {
      ok: false,
      mode,
      reason: "unknown-place",
      message: "That location is not on the road network.",
      blockedEdges: blocked,
    };
  }

  if (startIdx === goalIdx) {
    return {
      ok: false,
      mode,
      reason: "same-place",
      message: "Origin and destination are the same place.",
      blockedEdges: blocked,
    };
  }

  const result = aStar(startIdx, goalIdx, passable);

  if (!result) {
    // No path. Work out whether the problem is at the origin, at the
    // destination, or in between, and suggest somewhere reachable.
    const originStranded = graph.nodes[startIdx].edges.every(
      (e) => !passable[e],
    );
    const destStranded = graph.nodes[goalIdx].edges.every((e) => !passable[e]);

    const alternative = originStranded
      ? undefined
      : nearestReachableLandmark(startIdx, [destNodeId, originNodeId], passable);

    const destName =
      landmarks.find((l) => l.nodeId === destNodeId)?.name ?? "the destination";

    // Only mention the horizon when there actually is one — with the horizon
    // set to "Now", "within the next 0 h" is nonsense.
    const withinHorizon =
      mode === "safest" && horizonH > 0 ? ` within the next ${horizonH} h` : "";

    let message: string;
    if (originStranded) {
      message =
        "Every road out of the starting point is under water. " +
        "Shelter in place and request water rescue.";
    } else if (destStranded) {
      message = `${destName} is surrounded by flooded roads and cannot be reached${withinHorizon}.`;
    } else {
      message = `No ${mode === "safest" ? "safe " : ""}route to ${destName}${withinHorizon} — the road network is severed between here and there.`;
    }

    return {
      ok: false,
      mode,
      reason: originStranded
        ? "origin-flooded"
        : destStranded
          ? "destination-flooded"
          : "no-route",
      message,
      nearestReachable: alternative,
      blockedEdges: blocked,
    };
  }

  // Assemble the successful route.
  const coordinates = stitchCoordinates(result.nodePath, result.edgePath);
  let etaHours = 0;
  const warnings: RouteWarning[] = [];

  for (let i = 0; i < result.edgePath.length; i++) {
    const edge = graph.edges[result.edgePath[i]];
    const arrivalH = etaHours;
    etaHours += edgeTravelHours(edge);

    // Does the model say this segment goes under while you are on it?
    //
    // The exposure window is [arrivalH, arrivalH + time on this segment]. The
    // flood timeline only has 15-minute resolution and the whole journey is
    // shorter than that, so we round the window OUTWARDS — floor the start,
    // ceil the end — and check every frame it touches. Flooring both ends
    // would collapse the window onto the departure timestep, where a
    // `fastest` route is passable by construction, and the check could never
    // fire at all.
    if (opts.timeline && opts.stepHours) {
      const base = opts.startStep ?? 0;
      const first = base + Math.floor(arrivalH / opts.stepHours);
      const last = base + Math.ceil(etaHours / opts.stepHours);
      let goesUnder = false;
      for (let st = first; st <= last && !goesUnder; st++) {
        const frame = opts.timeline[Math.min(st, opts.timeline.length - 1)];
        if (frame && isEdgeBlocked(edge, frame)) goesUnder = true;
      }
      if (goesUnder) {
        warnings.push({
          edgeId: edge.id,
          roadName: edge.name,
          arrivalH,
          message: `${edge.name} goes under while you are still on it — you reach it ${formatLead(arrivalH)} in.`,
        });
        continue;
      }
    }

    // Otherwise, does it flood at some point before the horizon?
    if (mode === "fastest" && isEdgeBlocked(edge, horizon)) {
      warnings.push({
        edgeId: edge.id,
        roadName: edge.name,
        arrivalH,
        message: `${edge.name} is predicted to flood within ${horizonH} h.`,
      });
    }
  }

  return {
    ok: true,
    mode,
    nodes: result.nodePath.map((i) => graph.nodes[i].id),
    edgeIds: result.edgePath.map((i) => graph.edges[i].id),
    coordinates,
    distanceM: result.distanceM,
    etaMinutes: etaHours * 60,
    warnings,
    passableEdges: passable.length - blocked,
    blockedEdges: blocked,
  };
}

function formatLead(hours: number): string {
  const mins = Math.round(hours * 60);
  return mins < 60 ? `${mins} min` : `${(hours).toFixed(1)} h`;
}

// ---------------------------------------------------------------------------
// Fallbacks and diagnostics
// ---------------------------------------------------------------------------

/**
 * Dijkstra from `startIdx` over passable edges, returning the closest landmark
 * that is still reachable. This is what turns a dead end into an actionable
 * "go here instead".
 *
 * `excludeNodeIds` holds the destination we already failed to reach and the
 * origin itself — suggesting the place you are currently standing in would be
 * technically true and completely useless.
 */
function nearestReachableLandmark(
  startIdx: number,
  excludeNodeIds: string[],
  passable: Uint8Array,
): RouteFailure["nearestReachable"] {
  const { nodes, edges } = graph;
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const cameFromNode = new Int32Array(nodes.length).fill(-1);
  const cameFromEdge = new Int32Array(nodes.length).fill(-1);
  const done = new Uint8Array(nodes.length);

  dist[startIdx] = 0;
  const heap = new MinHeap();
  heap.push(startIdx, 0);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    for (const edgeIdx of nodes[cur].edges) {
      if (!passable[edgeIdx]) continue;
      const edge = edges[edgeIdx];
      const next = edge.a === cur ? edge.b : edge.a;
      const alt = dist[cur] + edge.lengthM;
      if (alt < dist[next]) {
        dist[next] = alt;
        cameFromNode[next] = cur;
        cameFromEdge[next] = edgeIdx;
        heap.push(next, alt);
      }
    }
  }

  let best: Landmark | null = null;
  let bestDist = Infinity;
  for (const lm of landmarks) {
    if (excludeNodeIds.includes(lm.nodeId)) continue;
    const idx = graph.nodeIndex.get(lm.nodeId);
    if (idx === undefined) continue;
    if (dist[idx] < bestDist) {
      bestDist = dist[idx];
      best = lm;
    }
  }

  if (!best || bestDist === Infinity) return undefined;

  // Rebuild the path to the suggested landmark.
  const goalIdx = graph.nodeIndex.get(best.nodeId)!;
  const nodePath: number[] = [];
  const edgePath: number[] = [];
  let cur = goalIdx;
  while (cur !== -1) {
    nodePath.push(cur);
    const e = cameFromEdge[cur];
    if (e !== -1) edgePath.push(e);
    cur = cameFromNode[cur];
  }
  nodePath.reverse();
  edgePath.reverse();

  let etaHours = 0;
  for (const e of edgePath) etaHours += edgeTravelHours(graph.edges[e]);

  return {
    landmark: best,
    distanceM: bestDist,
    etaMinutes: etaHours * 60,
    coordinates: stitchCoordinates(nodePath, edgePath),
  };
}

/**
 * Network distance in metres from `fromNodeId` to every node still reachable
 * over passable roads. Nodes that are cut off are simply absent from the map.
 *
 * One Dijkstra pass answers "how far is everything from here", which is what
 * both surfaces need to say whether a shelter, a resource or a volunteer job
 * is still reachable and how far away it is. Over 66 nodes this is trivial,
 * so it is cheaper to compute the whole field once than to route repeatedly.
 */
export function networkDistancesFrom(
  fromNodeId: string,
  frame: FloodFrame,
): Map<string, number> {
  const out = new Map<string, number>();
  const startIdx = graph.nodeIndex.get(fromNodeId);
  if (startIdx === undefined) return out;

  const passable = passableEdgeFlags(frame);
  const dist = new Float64Array(graph.nodes.length).fill(Infinity);
  const done = new Uint8Array(graph.nodes.length);
  dist[startIdx] = 0;

  const heap = new MinHeap();
  heap.push(startIdx, 0);
  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    out.set(graph.nodes[cur].id, dist[cur]);

    for (const edgeIdx of graph.nodes[cur].edges) {
      if (!passable[edgeIdx]) continue;
      const edge = graph.edges[edgeIdx];
      const next = edge.a === cur ? edge.b : edge.a;
      const alt = dist[cur] + edge.lengthM;
      if (alt < dist[next]) {
        dist[next] = alt;
        heap.push(next, alt);
      }
    }
  }
  return out;
}

/**
 * Which landmarks cannot be reached from `fromNodeId` given a flood state.
 * Drives the "N landmarks cut off" figure in the status panel.
 */
export function cutOffLandmarks(
  fromNodeId: string,
  frame: FloodFrame,
): Landmark[] {
  const reachable = networkDistancesFrom(fromNodeId, frame);
  return landmarks.filter((lm) => !reachable.has(lm.nodeId));
}

/**
 * Compact label for a landmark, for places where the full name will not fit
 * (map pins, the "cut off" list). Keyed on kind rather than sliced off the
 * name, so "Ferry Dock" does not become "Dock".
 */
const SHORT_NAMES: Record<string, string> = {
  hospital: "Hospital",
  shelter: "Shelter",
  "town-center": "Town Center",
  marina: "Marina",
  ferry: "Ferry Dock",
};

export const shortName = (lm: Landmark) => SHORT_NAMES[lm.kind] ?? lm.name;

/** Look up a landmark by id. */
export const landmarkById = (id: string) =>
  landmarks.find((l) => l.id === id);

/** Nearest graph node to an arbitrary click on the map. */
export function nearestNode(lng: number, lat: number): GraphNode {
  let best = graph.nodes[0];
  let bestD = Infinity;
  for (const n of graph.nodes) {
    const d = haversine(lng, lat, n.lng, n.lat);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
