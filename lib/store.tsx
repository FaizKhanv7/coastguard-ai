"use client";

/**
 * App-wide state for the operations dashboard.
 *
 * The dashboard is a multi-page app now — home, map, report, resources,
 * volunteer, assistant — so simulation state has to outlive any one page.
 * It lives here, in a provider mounted in the root layout, which means:
 *
 *   - the flood model is precomputed ONCE, not per page;
 *   - scrubbing to the storm peak on /map and then walking to /resources
 *     shows you resources at the storm peak;
 *   - a hazard reported on /report appears on /map and / immediately.
 *
 * Everything is in memory. There is no backend by design, and a refresh
 * resets to the seed data, which is the behaviour you want when demoing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  community,
  precomputeAll,
  stateAt,
  displayedState,
  statusAt,
  route as engineRoute,
  reachability,
  bestShelter,
  nearestNode,
  landmarks,
  blockedEdgeIdsAt,
  HORIZONS,
  STEP_COUNT,
  hoursToStep,
  type FloodState,
  type RouteResult,
  type RiskTolerance,
  type Incident,
  type Resource,
  type VolunteerJob,
  type Status,
} from "./engine";

export type Horizon = (typeof HORIZONS)[number];

/** Milliseconds between playback ticks. */
const PLAY_INTERVAL_MS = 80;

export interface CoastguardStore {
  ready: boolean;

  // --- Simulation ---
  step: number;
  setStep: (s: number) => void;
  playing: boolean;
  togglePlay: () => void;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;

  current: FloodState;
  displayed: FloodState;
  status: Status;

  // --- Routing ---
  originId: string;
  destId: string;
  setOriginId: (id: string) => void;
  setDestId: (id: string) => void;
  swapEnds: () => void;
  mode: RiskTolerance;
  setMode: (m: RiskTolerance) => void;
  route: RouteResult;
  comparison: RouteResult;
  blockedEdges: Set<string>;
  originNodeId: string;

  // --- Community, mutable ---
  incidents: Incident[];
  resources: Resource[];
  jobs: VolunteerJob[];
  claimed: Set<string>;
  joined: Set<string>;

  reportIncident: (input: NewIncident) => Incident;
  toggleClaim: (resourceId: string) => void;
  addResource: (input: NewResource) => Resource;
  toggleJoin: (jobId: string) => void;
  addJob: (input: NewJob) => VolunteerJob;

  /** Reachability of any placed list, from the current origin and moment. */
  reach: <T extends { nodeId: string }>(items: T[]) => ReachRow<T>[];
  recommendedShelter: ReturnType<typeof bestShelter>;
}

export interface ReachRow<T> {
  item: T;
  reachable: boolean;
  distanceM: number | null;
  etaMinutes: number | null;
}

export interface NewIncident {
  title: string;
  category: string;
  severity: "High" | "Medium" | "Low";
  icon: string;
  lng: number;
  lat: number;
  depthM?: number;
}

export interface NewResource {
  name: string;
  category: string;
  icon: string;
  owner: string;
  quantity: number;
}

export interface NewJob {
  title: string;
  needed: number;
  durationHours: number;
  urgent: boolean;
  accessibility: boolean;
}

const Ctx = createContext<CoastguardStore | null>(null);

export function CoastguardProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState(hoursToStep(4));
  const [playing, setPlaying] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>(0);
  const [originId, setOriginId] = useState("uscg-sector-miami");
  const [destId, setDestId] = useState("jackson-memorial");
  const [mode, setMode] = useState<RiskTolerance>("fastest");

  const [incidents, setIncidents] = useState<Incident[]>(community.incidents);
  const [resources, setResources] = useState<Resource[]>(community.resources);
  const [jobs, setJobs] = useState<VolunteerJob[]>(community.volunteerJobs);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());

  // Precompute every flood state once, after first paint. One synchronous
  // pass (~250 ms) rather than spread across animation frames, which are
  // throttled to ~1 Hz whenever the tab is not in the foreground.
  useEffect(() => {
    const id = window.setTimeout(() => {
      precomputeAll();
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!playing || !ready) return;
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= STEP_COUNT - 1) {
          setPlaying(false);
          return STEP_COUNT - 1;
        }
        return s + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, ready]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p) setStep((s) => (s >= STEP_COUNT - 1 ? 0 : s));
      return !p;
    });
  }, []);

  const swapEnds = useCallback(() => {
    setOriginId(destId);
    setDestId(originId);
  }, [originId, destId]);

  const originNodeId =
    landmarks.find((l) => l.id === originId)?.nodeId ?? landmarks[0].nodeId;
  const destNodeId =
    landmarks.find((l) => l.id === destId)?.nodeId ?? landmarks[1].nodeId;

  const current = useMemo(() => stateAt(step), [step]);
  const displayed = useMemo(
    () => displayedState(step, horizon),
    [step, horizon],
  );
  const status = useMemo(
    () => statusAt(step, horizon, originNodeId),
    [step, horizon, originNodeId],
  );

  const route = useMemo(
    () => engineRoute(originNodeId, destNodeId, { step, horizonH: horizon, mode }),
    [originNodeId, destNodeId, step, horizon, mode],
  );
  const comparison = useMemo(
    () =>
      engineRoute(originNodeId, destNodeId, {
        step,
        horizonH: horizon,
        mode: mode === "safest" ? "fastest" : "safest",
      }),
    [originNodeId, destNodeId, step, horizon, mode],
  );

  const blockedEdges = useMemo(
    () => new Set(blockedEdgeIdsAt(step, horizon)),
    [step, horizon],
  );

  const reach = useCallback(
    <T extends { nodeId: string }>(items: T[]): ReachRow<T>[] =>
      reachability(items, originNodeId, { step, horizonH: horizon, mode }),
    [originNodeId, step, horizon, mode],
  );

  const recommendedShelter = useMemo(
    () => bestShelter(originNodeId, { step, horizonH: horizon, mode }),
    [originNodeId, step, horizon, mode],
  );

  // --- Community actions ---------------------------------------------------

  const reportIncident = useCallback((input: NewIncident): Incident => {
    // Snap the report onto the road network so it can be routed to, exactly
    // as the generator does for the seed data.
    const node = nearestNode(input.lng, input.lat);
    const incident: Incident = {
      id: `inc-user-${Date.now()}`,
      nodeId: node.id,
      lng: node.lng,
      lat: node.lat,
      elevationM: 0,
      title: input.title,
      category: input.category,
      severity: input.severity,
      icon: input.icon,
      reportedMinutesAgo: 0,
      confirmations: 1,
    };
    setIncidents((prev) => [incident, ...prev]);
    return incident;
  }, []);

  const toggleClaim = useCallback((resourceId: string) => {
    setClaimed((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }, []);

  const addResource = useCallback((input: NewResource): Resource => {
    const node = nearestNode(landmarks[2].lng, landmarks[2].lat);
    const resource: Resource = {
      id: `res-user-${Date.now()}`,
      nodeId: node.id,
      lng: node.lng,
      lat: node.lat,
      elevationM: 0,
      name: input.name,
      category: input.category,
      icon: input.icon,
      owner: input.owner,
      verified: false,
      status: "Available",
      quantity: input.quantity,
    };
    setResources((prev) => [resource, ...prev]);
    return resource;
  }, []);

  const toggleJoin = useCallback((jobId: string) => {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const addJob = useCallback((input: NewJob): VolunteerJob => {
    const node = nearestNode(landmarks[2].lng, landmarks[2].lat);
    const job: VolunteerJob = {
      id: `job-user-${Date.now()}`,
      nodeId: node.id,
      lng: node.lng,
      lat: node.lat,
      elevationM: 0,
      title: input.title,
      needed: input.needed,
      joined: 0,
      durationHours: input.durationHours,
      urgent: input.urgent,
      accessibility: input.accessibility,
      verifiedBy: "Operations desk",
    };
    setJobs((prev) => [job, ...prev]);
    return job;
  }, []);

  const value: CoastguardStore = {
    ready,
    step,
    setStep,
    playing,
    togglePlay,
    horizon,
    setHorizon,
    current,
    displayed,
    status,
    originId,
    destId,
    setOriginId,
    setDestId,
    swapEnds,
    mode,
    setMode,
    route,
    comparison,
    blockedEdges,
    originNodeId,
    incidents,
    resources,
    jobs,
    claimed,
    joined,
    reportIncident,
    toggleClaim,
    addResource,
    toggleJoin,
    addJob,
    reach,
    recommendedShelter,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoastguard(): CoastguardStore {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useCoastguard must be used inside <CoastguardProvider>");
  }
  return ctx;
}
