/**
 * ============================================================================
 * CoastGuard engine — the single API both surfaces run on
 * ============================================================================
 * The operations dashboard (Next.js) imports this module directly. The field
 * app (`coastguard-ai.html`, a plain static page) gets the exact same code as
 * `window.CoastGuard`, bundled by `npm run build:engine`.
 *
 * That matters: before this existed, the field app had no flood model at all
 * and its own hardcoded geography, so the two surfaces disagreed about where
 * things were and what was underwater. Now there is one flood model, one road
 * graph and one community dataset behind both.
 *
 * Everything here is pure apart from the memo cache and the canvas used to
 * paint the flood raster.
 * ============================================================================
 */

import communityJson from "../data/community.json";
import {
  simulateFloodAt,
  floodedLandFraction,
  forcing,
  waterLevels,
  STEP_COUNT,
  STEP_HOURS,
  hoursToStep,
  type FloodState,
} from "./flood";
import {
  graph,
  landmarks,
  findRoute,
  blockedEdgeIds,
  cutOffLandmarks,
  networkDistancesFrom,
  nearestNode,
  shortName,
  isEdgeBlocked,
  type RiskTolerance,
  type RouteResult,
  type Landmark,
} from "./routing";
import { dem, cellAt, elevations } from "./dem";
import { renderFloodImage, floodImageCoordinates } from "./raster";

// ---------------------------------------------------------------------------
// Community layer
// ---------------------------------------------------------------------------

export interface CommunityPlace {
  id: string;
  nodeId: string;
  lng: number;
  lat: number;
  elevationM: number;
}

export interface Shelter extends CommunityPlace {
  name: string;
  type: string;
  capacityTotal: number;
  capacityUsed: number;
  accessible: boolean;
}

export interface Incident extends CommunityPlace {
  title: string;
  category: string;
  severity: "High" | "Medium" | "Low";
  icon: string;
  reportedMinutesAgo: number;
  confirmations: number;
}

export interface Resource extends CommunityPlace {
  name: string;
  category: string;
  icon: string;
  owner: string;
  verified: boolean;
  status: string;
  quantity: number;
}

export interface VolunteerJob extends CommunityPlace {
  title: string;
  needed: number;
  joined: number;
  durationHours: number;
  urgent: boolean;
  accessibility: boolean;
  verifiedBy: string;
}

export interface Community {
  shelters: Shelter[];
  incidents: Incident[];
  resources: Resource[];
  volunteerJobs: VolunteerJob[];
}

export const community: Community = communityJson as unknown as Community;

// ---------------------------------------------------------------------------
// Memoised flood states
// ---------------------------------------------------------------------------

const cache = new Array<FloodState | undefined>(STEP_COUNT);

/** Flood state at a timestep. Computed on first request, then cached. */
export function stateAt(step: number): FloodState {
  const i = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(step)));
  const hit = cache[i];
  if (hit) return hit;
  const computed = simulateFloodAt(i);
  cache[i] = computed;
  return computed;
}

/**
 * Fills the whole cache and returns it as a dense array.
 *
 * The dashboard calls this behind its loading state so that scrubbing is an
 * array index. The field app does not — it lets the cache warm lazily, which
 * gets a phone to first paint sooner.
 */
export function precomputeAll(onProgress?: (f: number) => void): FloodState[] {
  for (let i = 0; i < STEP_COUNT; i++) {
    stateAt(i);
    if (onProgress && i % 32 === 0) onProgress(i / STEP_COUNT);
  }
  onProgress?.(1);
  return cache as FloodState[];
}

/** True once every timestep is cached. */
export const isWarm = () => cache.every(Boolean);

/**
 * The moment a surface is displaying: the scrubbed step plus the forecast
 * horizon. With the horizon at 0 this is simply the current step.
 */
export function displayedState(step: number, horizonH: number): FloodState {
  if (!horizonH) return stateAt(step);
  return stateAt(Math.round(step) + hoursToStep(horizonH));
}

/**
 * The worst flood state between now and the horizon — what `safest` routing
 * plans against.
 *
 * Computed directly rather than by delegating to worstCaseThroughHorizon,
 * because that helper clamps against the full timeline length and would read
 * past the end of a short slice near the end of the window. It also lets us
 * pick the peak from the cheap water-level series first and only materialise
 * the one flood state we actually need — the mask is monotonic in level, so
 * the highest level in the window is the worst case (see lib/flood.ts).
 */
export function worstCase(step: number, horizonH: number): FloodState {
  const start = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(step)));
  const end = Math.max(
    0,
    Math.min(STEP_COUNT - 1, start + hoursToStep(horizonH)),
  );

  let peakIndex = start;
  for (let i = start + 1; i <= end; i++) {
    if (waterLevels[i].levelM > waterLevels[peakIndex].levelM) peakIndex = i;
  }
  return stateAt(peakIndex);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface Status {
  step: number;
  horizonH: number;
  hours: number;
  waterLevelM: number;
  tideM: number;
  surgeM: number;
  rainfallMmHr: number;
  rainAccumM: number;
  windKph: number;
  blockedCount: number;
  totalSegments: number;
  cutOff: Landmark[];
  floodedFraction: number;
  isolatedCells: number;
  severity: "normal" | "elevated" | "flooding" | "severe";
}

const severityOf = (level: number): Status["severity"] =>
  level > 2.5 ? "severe" : level > 1.5 ? "flooding" : level > 0.6 ? "elevated" : "normal";

/** Ids of the road segments impassable at the displayed moment. */
export function blockedEdgeIdsAt(step: number, horizonH = 0): string[] {
  return blockedEdgeIds(displayedState(step, horizonH));
}

/** Everything a status readout needs, for whichever moment is on screen. */
export function statusAt(
  step: number,
  horizonH = 0,
  originNodeId?: string,
): Status {
  const s = displayedState(step, horizonH);
  const origin = originNodeId ?? landmarks[0].nodeId;
  return {
    step: Math.round(step),
    horizonH,
    hours: s.hours,
    waterLevelM: s.waterLevelM,
    tideM: s.tideM,
    surgeM: s.surgeM,
    rainfallMmHr: s.rainfallMmHr,
    rainAccumM: s.rainAccumM,
    windKph: s.windKph,
    blockedCount: blockedEdgeIds(s).length,
    totalSegments: graph.edges.length,
    cutOff: cutOffLandmarks(origin, s),
    floodedFraction: floodedLandFraction(s),
    isolatedCells: s.isolatedCells,
    severity: severityOf(s.waterLevelM),
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface RouteOptions {
  step: number;
  horizonH?: number;
  mode?: RiskTolerance;
}

/** Route between two graph nodes at a given moment and risk tolerance. */
export function route(
  fromNodeId: string,
  toNodeId: string,
  { step, horizonH = 0, mode = "fastest" }: RouteOptions,
): RouteResult {
  const start = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(step)));
  // `safest` needs the frames between here and the horizon; warm just those.
  const timeline: FloodState[] = [];
  const end = Math.min(STEP_COUNT - 1, start + hoursToStep(horizonH || 6));
  for (let i = start; i <= end; i++) timeline.push(stateAt(i));

  return findRoute(fromNodeId, toNodeId, {
    current: stateAt(start),
    horizon: worstCase(start, horizonH),
    mode,
    horizonH,
    timeline,
    startStep: 0,
    stepHours: STEP_HOURS,
  });
}

export interface ReachableItem<T> {
  item: T;
  reachable: boolean;
  distanceM: number | null;
  etaMinutes: number | null;
}

/** Average driving speed used to turn network distance into a rough ETA. */
const NOMINAL_KPH = 32;

/**
 * Annotates any list of placed community items with whether they can still be
 * reached from an origin, and how far away they are by road.
 *
 * This is the join between the community layer and the flood model — it is
 * what lets a shelter card say "cut off" instead of just sitting there
 * looking available while the road to it is under a metre of water.
 */
export function reachability<T extends { nodeId: string }>(
  items: T[],
  fromNodeId: string,
  { step, horizonH = 0, mode = "fastest" }: RouteOptions,
): ReachableItem<T>[] {
  const frame = mode === "safest" ? worstCase(step, horizonH) : displayedState(step, horizonH);
  const distances = networkDistancesFrom(fromNodeId, frame);

  return items.map((item) => {
    const d = distances.get(item.nodeId);
    return {
      item,
      reachable: d !== undefined,
      distanceM: d ?? null,
      etaMinutes: d === undefined ? null : (d / 1000 / NOMINAL_KPH) * 60,
    };
  });
}

/**
 * The best shelter to send someone to: reachable, then by how far it is,
 * with a nudge towards high ground and spare capacity.
 */
export function bestShelter(
  fromNodeId: string,
  opts: RouteOptions,
): ReachableItem<Shelter> | null {
  const ranked = reachability(community.shelters, fromNodeId, opts)
    .filter((r) => r.reachable && r.item.capacityUsed < r.item.capacityTotal)
    .sort((a, b) => {
      // Distance dominates, but a shelter 10 m higher is worth a short detour.
      const scoreA = a.distanceM! - a.item.elevationM * 12;
      const scoreB = b.distanceM! - b.item.elevationM * 12;
      return scoreA - scoreB;
    });
  return ranked[0] ?? null;
}

/**
 * Standing water depth at a point, in metres, at the displayed moment.
 * Returns 0 when the point is dry OR when it is a hollow below the water line
 * that has no path to the sea — the connectivity model decides, not elevation.
 *
 * This is what lets a community card say "0.8 m of water here now" instead of
 * leaving the reader to guess whether a reported hazard is still live.
 */
export function floodDepthAt(
  lng: number,
  lat: number,
  step: number,
  horizonH = 0,
): number {
  const s = displayedState(step, horizonH);
  const cell = cellAt(lng, lat);
  if (cell < 0 || !s.flooded[cell]) return 0;
  return Math.max(0, s.waterLevelM - elevations[cell]);
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Flood raster for the displayed moment, as a PNG data URL. */
export function floodImage(step: number, horizonH = 0): string {
  return renderFloodImage(displayedState(step, horizonH));
}

/** Corner order MapLibre wants: TL, TR, BR, BL. */
export const maplibreImageCoordinates = floodImageCoordinates;

/** Corner order Leaflet wants: [[south, west], [north, east]]. */
export const leafletImageBounds: [[number, number], [number, number]] = [
  [dem.bbox.latMin, dem.bbox.lngMin],
  [dem.bbox.latMax, dem.bbox.lngMax],
];

/** Formats a timestep as a clock time within the 48 h window. */
export function formatClock(step: number): string {
  const hours = Math.round(step) * STEP_HOURS;
  const day = Math.floor(hours / 24) + 1;
  const h = Math.floor(hours % 24);
  const m = Math.round((hours % 1) * 60);
  return `Day ${day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const HORIZONS = [0, 6, 12, 24] as const;

export {
  STEP_COUNT,
  STEP_HOURS,
  hoursToStep,
  landmarks,
  graph,
  nearestNode,
  shortName,
  isEdgeBlocked,
  dem,
};

export const stormPeakHour = forcing.stormPeakHour;
export const totalHours = (STEP_COUNT - 1) * STEP_HOURS;

/**
 * Water level across the whole window, for sparklines.
 *
 * Read straight off the forcing integration rather than from the flood states
 * — asking for 193 flood states here would force the entire simulation at
 * import time and undo the lazy cache above.
 */
export const levelSeries = waterLevels.map((w) => w.levelM);

export type { FloodState, RouteResult, RiskTolerance, Landmark };
