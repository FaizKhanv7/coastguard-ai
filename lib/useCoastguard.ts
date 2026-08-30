"use client";

/**
 * The one hook that owns all simulation state for the dashboard.
 *
 * PERFORMANCE CONTRACT
 * Every one of the 193 flood states is computed once, on mount, behind a
 * loading bar. After that, scrubbing the timeline is an array index and
 * routing is a ~0.1 ms A* run, so playback stays smooth without any
 * throttling hacks. Nothing in here re-runs the flood fill on a frame.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  simulateFloodAt,
  worstCaseThroughHorizon,
  floodedLandFraction,
  forcing,
  waterLevels,
  STEP_COUNT,
  STEP_HOURS,
  hoursToStep,
  type FloodState,
} from "./flood";
import { CELL_COUNT } from "./dem";
import {
  findRoute,
  blockedEdgeIds,
  cutOffLandmarks,
  landmarks,
  graph,
  type RiskTolerance,
  type RouteResult,
} from "./routing";

const EMPTY_MASK = new Uint8Array(CELL_COUNT);

/** Horizon options offered by the toggle, in hours. 0 means "right now". */
export const HORIZONS = [0, 6, 12, 24] as const;
export type Horizon = (typeof HORIZONS)[number];

/** Timesteps advanced per animation tick during playback. */
const PLAY_STEP = 1;
/** Milliseconds between playback ticks — 12 fps of simulated time. */
const PLAY_INTERVAL_MS = 80;

export interface CoastguardState {
  ready: boolean;
  progress: number;

  step: number;
  setStep: (s: number) => void;
  playing: boolean;
  togglePlay: () => void;

  horizon: Horizon;
  setHorizon: (h: Horizon) => void;

  originId: string;
  destId: string;
  setOriginId: (id: string) => void;
  setDestId: (id: string) => void;
  swapEnds: () => void;

  mode: RiskTolerance;
  setMode: (m: RiskTolerance) => void;

  /** Flood state at the current timestep. */
  current: FloodState;
  /** Flood state shown on the map — `current`, or the projection at horizon. */
  displayed: FloodState;
  /** Worst case between now and the horizon; what `safest` plans against. */
  worstCase: FloodState;

  route: RouteResult;
  /** The other mode's route, drawn as a comparison line. */
  comparison: RouteResult;

  blockedEdges: Set<string>;
  cutOff: ReturnType<typeof cutOffLandmarks>;
  floodedFraction: number;
}

export function useCoastguard(): CoastguardState {
  const [states, setStates] = useState<FloodState[] | null>(null);
  const [progress, setProgress] = useState(0);

  const [step, setStep] = useState(hoursToStep(4)); // start in calm conditions
  const [playing, setPlaying] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>(12);
  const [originId, setOriginId] = useState("marina");
  const [destId, setDestId] = useState("hospital");
  const [mode, setMode] = useState<RiskTolerance>("fastest");

  // ---------------------------------------------------------------------
  // Precompute every timestep, yielding to the browser so the loading bar
  // actually paints instead of the whole thing blocking one frame.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // One setTimeout so the skeleton gets a chance to paint, then the whole
    // simulation in a single synchronous pass — roughly 250 ms for all 193
    // timesteps. Spreading the work across animation frames looked smoother
    // in theory but requestAnimationFrame is throttled to ~1 Hz whenever the
    // tab is not in the foreground, which turned a quarter-second job into a
    // fifteen-second one. A short reliable block beats a long pretty one.
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const computed: FloodState[] = [];
      for (let i = 0; i < STEP_COUNT; i++) computed.push(simulateFloodAt(i));
      if (cancelled) return;
      setProgress(1);
      setStates(computed);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  // ---------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (!playing || !states) return;
    const id = window.setInterval(() => {
      setStep((s) => {
        const next = s + PLAY_STEP;
        if (next >= STEP_COUNT - 1) {
          setPlaying(false);
          return STEP_COUNT - 1;
        }
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, states]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      // Restarting from the end should replay from the beginning.
      if (!p) setStep((s) => (s >= STEP_COUNT - 1 ? 0 : s));
      return !p;
    });
  }, []);

  const swapEnds = useCallback(() => {
    setOriginId(destId);
    setDestId(originId);
  }, [originId, destId]);

  // ---------------------------------------------------------------------
  // Derived state. Each memo is keyed so it only recomputes when it must.
  // ---------------------------------------------------------------------

  // While the simulation is still running we hand out a dry placeholder
  // rather than calling simulateFloodAt, so the loading render does not pay
  // for a flood fill it is about to throw away.
  const current = useMemo(
    () => states?.[step] ?? dryPlaceholder(step),
    [states, step],
  );

  const worstCase = useMemo(
    () =>
      states ? worstCaseThroughHorizon(states, step, horizon) : current,
    [states, step, horizon, current],
  );

  // The map shows the projection at the selected horizon; with "Now" selected
  // that is just the current state.
  const displayed = useMemo(() => {
    if (horizon === 0 || !states) return current;
    const target = Math.min(STEP_COUNT - 1, step + hoursToStep(horizon));
    return states[target];
  }, [states, step, horizon, current]);

  const routeOptions = useMemo(
    () => ({
      current,
      horizon: worstCase,
      horizonH: horizon,
      timeline: states ?? undefined,
      startStep: step,
      stepHours: STEP_HOURS,
    }),
    [current, worstCase, horizon, states, step],
  );

  const origin = landmarks.find((l) => l.id === originId) ?? landmarks[0];
  const dest = landmarks.find((l) => l.id === destId) ?? landmarks[1];

  const route = useMemo(
    () => findRoute(origin.nodeId, dest.nodeId, { ...routeOptions, mode }),
    [origin.nodeId, dest.nodeId, routeOptions, mode],
  );

  // The opposite mode, so the map can show both lines at once. This is the
  // side-by-side that makes the risk trade-off legible.
  const comparison = useMemo(
    () =>
      findRoute(origin.nodeId, dest.nodeId, {
        ...routeOptions,
        mode: mode === "safest" ? "fastest" : "safest",
      }),
    [origin.nodeId, dest.nodeId, routeOptions, mode],
  );

  // Road closures are shown for what is on the map right now.
  const blockedEdges = useMemo(
    () => new Set(blockedEdgeIds(displayed)),
    [displayed],
  );

  const cutOff = useMemo(
    () => cutOffLandmarks(origin.nodeId, displayed),
    [origin.nodeId, displayed],
  );

  const floodedFraction = useMemo(
    () => floodedLandFraction(displayed),
    [displayed],
  );

  return {
    ready: states !== null,
    progress,
    step,
    setStep,
    playing,
    togglePlay,
    horizon,
    setHorizon,
    originId,
    destId,
    setOriginId,
    setDestId,
    swapEnds,
    mode,
    setMode,
    current,
    displayed,
    worstCase,
    route,
    comparison,
    blockedEdges,
    cutOff,
    floodedFraction,
  };
}

/** A dry, zero-cost stand-in used only while the simulation is loading. */
function dryPlaceholder(step: number): FloodState {
  const w = waterLevels[Math.max(0, Math.min(STEP_COUNT - 1, step))];
  return {
    index: w.index,
    hours: w.hours,
    waterLevelM: w.levelM,
    tideM: w.tideM,
    surgeM: w.surgeM,
    rainAccumM: w.rainAccumM,
    rainfallMmHr: w.rainfallMmHr,
    windKph: w.windKph,
    flooded: EMPTY_MASK,
    floodedCells: 0,
    isolatedCells: 0,
  };
}

/** Formats a timestep as a clock time within the 48 h window. */
export function formatClock(step: number): string {
  const hours = step * STEP_HOURS;
  const day = Math.floor(hours / 24) + 1;
  const h = Math.floor(hours % 24);
  const m = Math.round((hours % 1) * 60);
  return `Day ${day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Water level series, for the scrubber's background sparkline. */
export const levelSeries = waterLevels.map((w) => w.levelM);
export const stormPeakHour = forcing.stormPeakHour;
export const totalSegments = graph.edges.length;
