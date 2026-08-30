/** Production Miami-Dade data ingestion for CoastGuard AI.
 *
 * Sources:
 * - USGS 3DEP ImageServer getSamples (elevation, metres / NAVD88)
 * - NOAA CO-OPS station 8723214 (Virginia Key) predictions + latest observation
 * - OpenStreetMap Overpass API road geometry
 *
 * Run on a networked machine with: npm run generate-data
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "data");
const ROWS = 300;
const COLS = 300;
const BOUNDS = [-80.25, 25.72, -80.12, 25.82] as const;
const [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT] = BOUNDS;
const META = {
  bounds: BOUNDS,
  // The requested 300 x 300 operational grid over this ~13 x 11 km bbox is
  // about 37-44 m per cell. Keep that distinct from the finer native 3DEP
  // source resolution so downstream code does not overstate spatial precision.
  resolution_m: 40.3,
  source_resolution: "USGS 3DEP best available (1 m where published)",
  datum: "NAVD88",
  location: "Miami-Dade Coastal Metro, FL",
};
const USGS_SAMPLES = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples";
const NOAA = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
/** Overpass rejects requests without a User-Agent with 406 Not Acceptable. */
const OVERPASS_HEADERS = {
  "content-type": "application/x-www-form-urlencoded",
  "User-Agent": "CoastGuardAI/1.0 (coastal flood response; contact: operations@coastguard.ai)",
};
const NOAA_STATION = "8723214";

/**
 * DESIGN STORM.
 *
 * NOAA gives us the real astronomical tide, which for Virginia Key runs
 * roughly -0.2 to +0.6 m NAVD88. Against Miami-Dade ground that sits between
 * 0 and 8 m, that alone floods nothing at all, and a flood tool that never
 * shows a flood is not a tool.
 *
 * So the tide is observed and the storm is a scenario: a Gaussian surge and a
 * rainfall band layered on top, of the scale Miami-Dade plans against. Every
 * output file records which parts are measured and which are modelled, and the
 * UI says so too. This is standard practice - FEMA and NOAA both plan against
 * design storms rather than waiting for a real one to measure.
 */
const DESIGN_STORM = {
  label: "Category 2 storm surge, Biscayne Bay",
  peakHour: 26,
  surgePeakM: 2.2,
  surgeWidthH: 5.0,
  rainPeakMmHr: 48,
  rainPeakHour: 23.5,
  rainWidthH: 3.2,
  windPeakKph: 165,
};
const SECONDARY_STATION = "8723170";

const landmarksSeed = [
  ["uscg-base-miami-beach", "USCG Base Miami Beach", "uscg", 25.7725, -80.1472],
  ["uscg-sector-miami", "USCG Sector Miami", "uscg", 25.7740, -80.1870],
  ["jackson-memorial", "Jackson Memorial Hospital", "hospital", 25.7905, -80.2132],
  ["portmiami-depot", "PortMiami Emergency Depot", "depot", 25.7766, -80.1704],
  ["brickell-zone-a", "Brickell Ave / Evacuation Zone A", "evacuation", 25.7617, -80.1918],
  ["fire-rescue-hq", "City of Miami Fire Rescue HQ", "fire", 25.7794, -80.2033],
  ["venetian-checkpoint", "Venetian Causeway Checkpoint", "checkpoint", 25.7898, -80.1652],
  ["macarthur-causeway", "MacArthur Causeway", "causeway", 25.7852, -80.1598],
  ["miami-beach-convention", "Miami Beach Convention Center Shelter", "shelter", 25.7946, -80.1339],
] as const;

type ElevSample = { value?: string | number; location?: { x: number; y: number } };
type RoadEdge = {
  type: "Feature";
  properties: { id: string; name: string; from: string; to: string; lengthM: number; speedKph: number; roadClass: string; structure: "bridge" | "tunnel" | "grade"; deckElevationM: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

function cellLng(col: number) { return MIN_LON + (col / (COLS - 1)) * (MAX_LON - MIN_LON); }
function cellLat(row: number) { return MIN_LAT + (row / (ROWS - 1)) * (MAX_LAT - MIN_LAT); }
function haversine(aLng: number, aLat: number, bLng: number, bLat: number) {
  const r = 6371000, d2r = Math.PI / 180;
  const dLat = (bLat - aLat) * d2r, dLng = (bLng - aLng) * d2r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d2r) * Math.cos(bLat * d2r) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}
function gridIndex(lng: number, lat: number) {
  const col = Math.max(0, Math.min(COLS - 1, Math.round(((lng - MIN_LON) / (MAX_LON - MIN_LON)) * (COLS - 1))));
  const row = Math.max(0, Math.min(ROWS - 1, Math.round(((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (ROWS - 1))));
  return row * COLS + col;
}
function speedFor(cls: string) {
  return ({ motorway: 90, trunk: 70, primary: 55, secondary: 45, tertiary: 40, residential: 30, unclassified: 30 } as Record<string, number>)[cls] ?? 30;
}
function nodeId(lng: number, lat: number) { return `n_${lng.toFixed(6)}_${lat.toFixed(6)}`; }

/** Canonical no-data marker. Below any water level, so the flood fill treats
 *  these cells as open water, which is what they are. */
const NO_DATA = -9999;
/** Lowest plausible road-deck height: MHHW (NAVD88) plus nominal clearance. */
const BRIDGE_DECK_FLOOR_M = 0.42 + 1.5;

/**
 * Replace USGS fill values with an explicit no-data marker.
 *
 * 3DEP is a bare-earth product and has no bare earth under Biscayne Bay, so it
 * returns constants there: this extract came back 22% exactly 0 and 15%
 * exactly -0.5. Those are not elevations. Left in, they read as land a few
 * centimetres below datum, which floods at the first high tide and severs 500+
 * road segments across the county at low water - a data artefact that looks
 * exactly like a flood result.
 *
 * Real LiDAR-derived elevations are effectively continuous, so any single
 * float repeated across more than 1% of a 90 000-cell grid is a fill value,
 * not terrain. We detect them that way rather than hardcoding, so this keeps
 * working if USGS changes its fill.
 */
/**
 * Trim precision that the model cannot use.
 *
 * 3DEP returns values like 0.060939878 — eight decimals, i.e. nanometres, for
 * a 40 m cell. Serialised across 90 000 cells and 4 658 road geometries that
 * is hundreds of kilobytes of noise, and the field app carries the whole lot
 * to a phone. 2 cm vertical and ~1 m horizontal is far finer than anything the
 * model claims.
 */
function quantiseDem(elevations: number[]) {
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] !== NO_DATA) {
      elevations[i] = Math.round(elevations[i] * 100) / 100;
    }
  }
}

function markNoData(elevations: number[]) {
  const counts = new Map<number, number>();
  for (const v of elevations) counts.set(v, (counts.get(v) ?? 0) + 1);
  const threshold = elevations.length * 0.01;
  const fills = [...counts.entries()]
    .filter(([value, count]) => count > threshold && value <= 0.5)
    .map(([value]) => value);

  let replaced = 0;
  if (fills.length) {
    const fillSet = new Set(fills);
    for (let i = 0; i < elevations.length; i++) {
      if (fillSet.has(elevations[i])) {
        elevations[i] = NO_DATA;
        replaced++;
      }
    }
  }
  const finite = elevations.filter((v) => v !== NO_DATA);
  console.log(
    `  DEM: ${replaced} no-data cells (${((replaced / elevations.length) * 100).toFixed(1)}%) ` +
      `from fill values [${fills.join(", ")}]; ${finite.length} real samples remain`,
  );
  return {
    noDataValue: NO_DATA,
    noDataCells: replaced,
    fillValuesDetected: fills,
    minElevation: finite.length ? Math.min(...finite) : 0,
    maxElevation: finite.length ? Math.max(...finite) : 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with exponential backoff.
 *
 * The DEM ingest is ~180 sequential calls to a public government endpoint and
 * the Overpass and NOAA calls are single points of failure. All three answer
 * 502/503/429 under load often enough that a run without retries fails more
 * often than it succeeds. Retries on transient status codes and network
 * errors; gives up immediately on a 4xx that is not 408/429, because those
 * mean the request itself is wrong and repeating it will not help.
 */
async function fetchRetry(url: string, init: RequestInit = {}, attempts = 5): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const transient = res.status >= 500 || res.status === 429 || res.status === 408;
      if (!transient) throw new Error(`${url} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && err.message.includes("HTTP 4")) throw err;
    }
    const wait = Math.min(20000, 1000 * 2 ** i) + Math.floor(Math.random() * 400);
    process.stdout.write(`
  retry ${i + 1}/${attempts - 1} in ${wait}ms (${String(lastErr).slice(0, 70)})
`);
    await sleep(wait);
  }
  throw new Error(`${url} failed after ${attempts} attempts: ${lastErr}`);
}

async function fetchDem() {
  const points: [number, number][] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) points.push([cellLng(col), cellLat(row)]);
  const elevations = new Array<number>(points.length);
  const batchSize = 500;
  for (let start = 0; start < points.length; start += batchSize) {
    const batch = points.slice(start, start + batchSize);
    const body = new URLSearchParams({
      f: "json",
      geometryType: "esriGeometryMultipoint",
      geometry: JSON.stringify({ points: batch, spatialReference: { wkid: 4326 } }),
      returnFirstValueOnly: "true",
      interpolation: "RSP_BilinearInterpolation",
      outFields: "*",
    });
    const res = await fetchRetry(USGS_SAMPLES, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    if (!res.ok) throw new Error(`USGS 3DEP ${res.status}: ${await res.text()}`);
    const json = await res.json() as { samples?: ElevSample[]; error?: { message: string } };
    if (!json.samples || json.error) throw new Error(`USGS 3DEP response error: ${json.error?.message ?? "missing samples"}`);
    json.samples.forEach((s, i) => { elevations[start + i] = Number(s.value); });
    process.stdout.write(`\rUSGS 3DEP: ${Math.min(points.length, start + batch.length)}/${points.length}`);
  }
  process.stdout.write("\n");
  const finite = elevations.filter(Number.isFinite);
  const cellSizeM = (haversine(MIN_LON, MIN_LAT, MAX_LON, MIN_LAT) / (COLS - 1) + haversine(MIN_LON, MIN_LAT, MIN_LON, MAX_LAT) / (ROWS - 1)) / 2;
  return {
    ...META,
    name: "Miami-Dade Coastal Metro DEM",
    description: "USGS 3DEP elevation samples for the Miami-Dade/Biscayne Bay operations grid. Row 0 is south; column 0 is west.",
    source: "USGS 3DEP 1-meter Bare Earth DEM via The National Map ImageServer getSamples",
    source_url: USGS_SAMPLES,
    generated_at: new Date().toISOString(),
    bbox: { lngMin: MIN_LON, lngMax: MAX_LON, latMin: MIN_LAT, latMax: MAX_LAT },
    cols: COLS, rows: ROWS, cellSizeM: Number(cellSizeM.toFixed(2)),
    minElevation: Math.min(...finite), maxElevation: Math.max(...finite), elevations,
  };
}

async function fetchNoaa() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const common = { application: "CoastguardAI", station: NOAA_STATION, datum: "NAVD", units: "metric", time_zone: "gmt", format: "json" };
  // 48 h of hourly astronomical predictions, so the window matches the app's
  // forecast horizon rather than a single day.
  const predUrl = `${NOAA}?${new URLSearchParams({ ...common, product: "predictions", begin_date: ymd, range: "48", interval: "h" })}`;
  const obsUrl = `${NOAA}?${new URLSearchParams({ ...common, product: "water_level", date: "latest" })}`;
  const [predRes, obsRes] = await Promise.all([fetchRetry(predUrl), fetch(obsUrl).catch(() => new Response("{}", { status: 503 }))]);
  if (!predRes.ok) throw new Error(`NOAA predictions ${predRes.status}`);
  const pred = await predRes.json() as { predictions?: { t: string; v: string }[] };
  const obs = obsRes.ok ? await obsRes.json() as { data?: { t: string; v: string; f?: string }[] } : { data: [] };
  if (!pred.predictions?.length) throw new Error("NOAA returned no predictions");

  const hourly = pred.predictions.map((p) => Number(p.v));

  // The app works in 15-minute steps. Tide is smooth over an hour, so linear
  // interpolation between the hourly predictions is well within the accuracy
  // the rest of the model claims.
  const STEP_MIN = 15;
  const PER_HOUR = 60 / STEP_MIN;
  const totalSteps = (hourly.length - 1) * PER_HOUR + 1;

  const gauss = (x: number, mu: number, sigma: number) =>
    Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

  const samples = Array.from({ length: totalSteps }, (_, index) => {
    const hours = index / PER_HOUR;
    const i = Math.min(hourly.length - 2, Math.floor(hours));
    const frac = hours - i;
    const tideM = hourly[i] + (hourly[i + 1] - hourly[i]) * frac;

    // Scenario layer. Clearly separated from the measured tide above.
    const surgeM = DESIGN_STORM.surgePeakM * gauss(hours, DESIGN_STORM.peakHour, DESIGN_STORM.surgeWidthH);
    const rainfallMmHr = Math.max(0, 1.2 + DESIGN_STORM.rainPeakMmHr * gauss(hours, DESIGN_STORM.rainPeakHour, DESIGN_STORM.rainWidthH));
    const windKph = 14 + (DESIGN_STORM.windPeakKph - 14) * gauss(hours, DESIGN_STORM.peakHour, DESIGN_STORM.surgeWidthH + 1);

    return {
      index,
      hours: Number(hours.toFixed(2)),
      tideM: Number(tideM.toFixed(3)),
      surgeM: Number(surgeM.toFixed(3)),
      rainfallMmHr: Number(rainfallMmHr.toFixed(2)),
      windKph: Number(windKph.toFixed(1)),
    };
  });

  const latest = obs.data?.[0];
  return {
    ...META,
    description:
      "48 h of water-level forcing on the Miami-Dade grid, at 15-minute steps. " +
      "tideM is MEASURED: NOAA CO-OPS astronomical predictions at Virginia Key " +
      "(metres NAVD88), interpolated from hourly to 15-minute. surgeM, " +
      "rainfallMmHr and windKph are a MODELLED design storm - see design_storm - " +
      "because the astronomical tide alone does not flood Miami-Dade and a " +
      "design storm is how coastal flood risk is actually planned against.",
    source: "NOAA CO-OPS (tide, measured) + CoastGuard AI design storm (surge/rain/wind, modelled)",
    data_status: "tide: observed prediction; surge/rain/wind: design scenario",
    generated_at: new Date().toISOString(),
    station: { id: NOAA_STATION, name: "Virginia Key, Biscayne Bay, FL" },
    secondary_station: { id: SECONDARY_STATION, name: "Miami Harbor Entrance / Miami Beach, FL", role: "historical prediction/reference station; not used for live observations" },
    latest_observation: latest ? { timestamp: latest.t, waterLevelM: Number(latest.v), flags: latest.f ?? "" } : null,
    design_storm: DESIGN_STORM,
    mhhw_navd88_m: 0.42,
    king_tide_surge_baseline_navd88_m: 1.10,
    startIso: `${pred.predictions[0].t.replace(" ", "T")}:00Z`,
    stepMinutes: STEP_MIN,
    steps: samples.length,
    stormPeakHour: DESIGN_STORM.peakHour,
    samples,
  };
}

async function fetchRoads(elevations: number[]) {
  const q = `[out:json][timeout:180][bbox:${MIN_LAT},${MIN_LON},${MAX_LAT},${MAX_LON}];way[highway~"^(motorway|trunk|primary|secondary|tertiary)$"];out tags geom;`;
  const res = await fetchRetry(OVERPASS, { method: "POST", body: new URLSearchParams({ data: q }), headers: OVERPASS_HEADERS }, 4);
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const json = await res.json() as { elements: Array<{ id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }> };

  const ways = json.elements.filter((w) => w.geometry && w.geometry.length >= 2);

  /*
   * Split each way at INTERSECTIONS, not at every vertex.
   *
   * Splitting per vertex turns a 50-point road into 49 one-hop edges, which
   * inflates the graph roughly fourfold, makes every A* node a bend in the
   * road rather than a junction, and balloons roads.json past what the field
   * app can reasonably carry. A vertex is an intersection if two different
   * ways share it, or if it is a way endpoint.
   */
  const seen = new Map<string, number>();
  for (const w of ways) {
    const local = new Set<string>();
    for (const g of w.geometry!) local.add(nodeId(g.lon, g.lat));
    for (const k of local) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const isJunction = (lng: number, lat: number) => (seen.get(nodeId(lng, lat)) ?? 0) > 1;

  const features: RoadEdge[] = [];
  let edgeSeq = 0;

  for (const way of ways) {
    const cls = way.tags?.highway ?? "unclassified";
    const name = way.tags?.name ?? `${cls} road`;
    const pts = way.geometry!;

    /*
     * Bridges and causeways need separate treatment, and getting this wrong is
     * the single biggest source of nonsense on a real DEM.
     *
     * 3DEP is a BARE EARTH model: under the MacArthur Causeway it records the
     * floor of Biscayne Bay, not the road deck. Sample the DEM naively and
     * every bridge in Miami reads as permanently under several metres of
     * water, so the router severs the causeways at low tide and the whole
     * result is garbage.
     *
     * So we tag the structure from OSM and, for a bridge, estimate the deck
     * from the ground at its two ends - which are on land - instead of the
     * water underneath. Conservative: it models the approaches rather than the
     * high span, so a bridge closes earlier than the real one would, which is
     * the safe direction to err in.
     */
    const isBridge = way.tags?.bridge != null && way.tags.bridge !== "no";
    const isTunnel = way.tags?.tunnel != null && way.tags.tunnel !== "no";
    const structure: "bridge" | "tunnel" | "grade" = isBridge ? "bridge" : isTunnel ? "tunnel" : "grade";

    // Break indices: start, every junction, end.
    const breaks = [0];
    for (let i = 1; i < pts.length - 1; i++) {
      if (isJunction(pts[i].lon, pts[i].lat)) breaks.push(i);
    }
    breaks.push(pts.length - 1);

    for (let b = 0; b < breaks.length - 1; b++) {
      const slice = pts.slice(breaks[b], breaks[b + 1] + 1);
      if (slice.length < 2) continue;

      const coords: [number, number][] = slice.map((g) => [
        Number(g.lon.toFixed(5)),
        Number(g.lat.toFixed(5)),
      ]);

      let lengthM = 0;
      let lowest = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const e = elevations[gridIndex(coords[i][0], coords[i][1])];
        // Ignore no-data: it is open water, not the lowest point of the road.
        // Including it made every waterside segment read as -9999 m and get
        // reported as permanently impassable.
        if (Number.isFinite(e) && e > NO_DATA && e < lowest) lowest = e;
        if (i > 0) lengthM += haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      }
      const hasGround = Number.isFinite(lowest);
      if (lengthM < 1) continue;

      const a = coords[0], z = coords[coords.length - 1];

      const endA = elevations[gridIndex(a[0], a[1])];
      const endZ = elevations[gridIndex(z[0], z[1])];
      const ends = [endA, endZ].filter((v) => Number.isFinite(v) && v > NO_DATA);
      // Bridge deck: the higher of the two abutments, since both sit on land.
      // Tunnel: the lower, since it dives below grade. Anything else follows
      // the ground it is built on.
      /*
       * A mid-span segment has both abutments over water, so the endpoint
       * estimate can come out below sea level - which no bridge is. Floor it
       * at mean higher high water plus a nominal clearance. This is explicitly
       * an estimate: without deck heights in OSM there is no measured value to
       * use, and a documented floor beats a number we know is impossible.
       */
      const deckElevationM =
        structure === "bridge"
          ? Math.max(ends.length ? Math.max(...ends) : 0, BRIDGE_DECK_FLOOR_M)
          : structure === "tunnel"
            ? (hasGround ? lowest - 3 : -3)
            // A grade road with no ground samples at all runs entirely over
            // water the DEM could not see - a low causeway OSM never tagged.
            // Treat it like a minimal bridge deck rather than as a trench.
            : (hasGround ? lowest : BRIDGE_DECK_FLOOR_M);

      features.push({
        type: "Feature",
        properties: {
          id: `osm_${way.id}_${edgeSeq++}`,
          name,
          from: nodeId(a[0], a[1]),
          to: nodeId(z[0], z[1]),
          lengthM: Number(lengthM.toFixed(1)),
          speedKph: speedFor(cls),
          roadClass: cls,
          structure,
          deckElevationM: Number(deckElevationM.toFixed(2)),
        },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  }

  /*
   * Keep only the largest connected component.
   *
   * An OSM extract clipped to a bounding box always contains fragments whose
   * only real connection to the network is outside the box - slip roads,
   * stubs, a causeway whose far end is beyond the edge. Left in, they are
   * nodes the router can never reach, so any landmark that snaps onto one is
   * permanently "cut off" no matter what the water is doing. That is a data
   * defect masquerading as a flood result, which is far worse than a missing
   * road.
   */
  const adjacency = new Map<string, string[]>();
  for (const f of features) {
    const { from, to } = f.properties;
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.has(to)) adjacency.set(to, []);
    adjacency.get(from)!.push(to);
    adjacency.get(to)!.push(from);
  }

  const componentOf = new Map<string, number>();
  let componentCount = 0;
  const sizes: number[] = [];
  for (const start of adjacency.keys()) {
    if (componentOf.has(start)) continue;
    const id = componentCount++;
    let size = 0;
    const stack = [start];
    componentOf.set(start, id);
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      for (const nb of adjacency.get(cur) ?? []) {
        if (!componentOf.has(nb)) {
          componentOf.set(nb, id);
          stack.push(nb);
        }
      }
    }
    sizes.push(size);
  }

  let largest = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[largest]) largest = i;
  const connected = features.filter((f) => componentOf.get(f.properties.from) === largest);

  console.log(
    `  roads: ${features.length} edges in ${componentCount} components; ` +
      `keeping the largest (${sizes[largest]} nodes, ${connected.length} edges)`,
  );

  return {
    ...META,
    type: "FeatureCollection",
    source: "OpenStreetMap via Overpass API",
    data_status: "observed",
    generated_at: new Date().toISOString(),
    road_classes: "motorway, trunk, primary, secondary, tertiary",
    note: "Ways are split at intersections; each feature is one junction-to-junction road segment with full geometry. Only the largest connected component is kept, so every node is routable.",
    components_found: componentCount,
    largest_component_nodes: sizes[largest],
    features: connected,
  };
}

function buildLandmarks(roads: { features: RoadEdge[] }, elevations: number[]) {
  const nodes = new Map<string, { id: string; lng: number; lat: number }>();
  for (const f of roads.features) {
    const [a, b] = f.geometry.coordinates;
    nodes.set(f.properties.from, { id: f.properties.from, lng: a[0], lat: a[1] });
    nodes.set(f.properties.to, { id: f.properties.to, lng: b[0], lat: b[1] });
  }
  const all = [...nodes.values()];
  const features = landmarksSeed.map(([id, name, kind, lat, lng]) => {
    let nearest = all[0], best = Infinity;
    for (const n of all) { const d = haversine(lng, lat, n.lng, n.lat); if (d < best) { best = d; nearest = n; } }
    return { type: "Feature", properties: { id, name, kind, nodeId: nearest?.id ?? `lm_${id}`, elevation: Number(elevations[gridIndex(lng, lat)].toFixed(2)), roadSnapDistanceM: Number(best.toFixed(1)) }, geometry: { type: "Point", coordinates: [lng, lat] } };
  });
  return { ...META, type: "FeatureCollection", source: "FDEM / City of Miami operational landmarks; coordinates supplied in migration specification", features };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  // REUSE_DEM=1 skips the 90 000-point USGS ingest and reuses data/dem.json.
  // The DEM is static terrain; the roads and tide are what get re-pulled.
  const dem = process.env.REUSE_DEM
    ? (JSON.parse(readFileSync(join(OUT_DIR, "dem.json"), "utf8")) as Awaited<ReturnType<typeof fetchDem>>)
    : await fetchDem();
  if (process.env.REUSE_DEM) console.log("  DEM: reusing data/dem.json (REUSE_DEM=1)");
  // Always re-run no-data detection, including on a reused DEM, so the marker
  // is present however the file was produced.
  quantiseDem(dem.elevations);
  Object.assign(dem, markNoData(dem.elevations));
  const [forcing, roads] = await Promise.all([fetchNoaa(), fetchRoads(dem.elevations)]);
  const landmarks = buildLandmarks(roads, dem.elevations);
  writeFileSync(join(OUT_DIR, "dem.json"), JSON.stringify(dem));
  writeFileSync(join(OUT_DIR, "forcing.json"), JSON.stringify(forcing, null, 2));
  writeFileSync(join(OUT_DIR, "roads.json"), JSON.stringify(roads));
  writeFileSync(join(OUT_DIR, "landmarks.json"), JSON.stringify(landmarks, null, 2));
  console.log(`Miami data written: ${dem.rows}x${dem.cols} DEM, ${roads.features.length} road edges, ${landmarks.features.length} landmarks, ${forcing.samples.length} hourly tide samples.`);
}

main().catch((err) => { console.error("generate-data failed:", err); process.exit(1); });
