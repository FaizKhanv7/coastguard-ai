/** Production Miami-Dade data ingestion for CoastGuard AI.
 *
 * Sources:
 * - USGS 3DEP ImageServer getSamples (elevation, metres / NAVD88)
 * - NOAA CO-OPS station 8723214 (Virginia Key) predictions + latest observation
 * - OpenStreetMap Overpass API road geometry
 *
 * Run on a networked machine with: npm run generate-data
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
const NOAA_STATION = "8723214";
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
  properties: { id: string; name: string; from: string; to: string; lengthM: number; speedKph: number; roadClass: string; baselineElevation: number; fromGrid: [number, number]; toGrid: [number, number] };
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

async function fetchDem() {
  const points: [number, number][] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) points.push([cellLng(col), cellLat(row)]);
  const elevations = new Array<number>(points.length);
  const batchSize = 750;
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
    const res = await fetch(USGS_SAMPLES, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
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
  const predUrl = `${NOAA}?${new URLSearchParams({ ...common, product: "predictions", begin_date: ymd, range: "24", interval: "h" })}`;
  const obsUrl = `${NOAA}?${new URLSearchParams({ ...common, product: "water_level", date: "latest" })}`;
  const [predRes, obsRes] = await Promise.all([fetch(predUrl), fetch(obsUrl)]);
  if (!predRes.ok) throw new Error(`NOAA predictions ${predRes.status}`);
  const pred = await predRes.json() as { predictions?: { t: string; v: string }[] };
  const obs = obsRes.ok ? await obsRes.json() as { data?: { t: string; v: string; f?: string }[] } : { data: [] };
  if (!pred.predictions?.length) throw new Error("NOAA returned no predictions");
  const samples = pred.predictions.slice(0, 24).map((p, index) => ({
    index, hours: index, timestamp: p.t, tideM: Number(p.v), surgeM: 0, rainfallMmHr: 0, windKph: 0,
  }));
  const latest = obs.data?.[0];
  return {
    ...META,
    description: "24 hourly NOAA CO-OPS astronomical tide predictions at Virginia Key, with the latest observed water level retained in metadata. Heights are metres NAVD88/NAVD.",
    source: "NOAA CO-OPS",
    station: { id: NOAA_STATION, name: "Virginia Key, Biscayne Bay, FL" },
    secondary_station: { id: SECONDARY_STATION, name: "Miami Harbor Entrance / Miami Beach, FL", role: "historical prediction/reference station; not used for live observations" },
    latest_observation: latest ? { timestamp: latest.t, waterLevelM: Number(latest.v), flags: latest.f ?? "" } : null,
    mhhw_navd88_m: 0.42,
    king_tide_surge_baseline_navd88_m: 1.10,
    startIso: `${pred.predictions[0].t.replace(" ", "T")}:00Z`, stepMinutes: 60, steps: samples.length, stormPeakHour: 0, samples,
  };
}

async function fetchRoads(elevations: number[]) {
  const q = `[out:json][timeout:120][bbox:${MIN_LAT},${MIN_LON},${MAX_LAT},${MAX_LON}];way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"];out tags geom;`;
  const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: q }), headers: { "content-type": "application/x-www-form-urlencoded" } });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const json = await res.json() as { elements: Array<{ id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }> };
  const features: RoadEdge[] = [];
  for (const way of json.elements) {
    if (!way.geometry || way.geometry.length < 2) continue;
    const cls = way.tags?.highway ?? "unclassified";
    for (let i = 0; i < way.geometry.length - 1; i++) {
      const a = way.geometry[i], b = way.geometry[i + 1];
      const coords: [number, number][] = [[a.lon, a.lat], [b.lon, b.lat]];
      const e0 = elevations[gridIndex(a.lon, a.lat)], e1 = elevations[gridIndex(b.lon, b.lat)];
      features.push({ type: "Feature", properties: {
        id: `osm_${way.id}_${i}`, name: way.tags?.name ?? `${cls} road`, from: nodeId(a.lon, a.lat), to: nodeId(b.lon, b.lat),
        lengthM: Number(haversine(a.lon, a.lat, b.lon, b.lat).toFixed(1)), speedKph: speedFor(cls), roadClass: cls,
        baselineElevation: Number(Math.min(e0, e1).toFixed(3)),
        fromGrid: [Math.round(((a.lon - MIN_LON) / (MAX_LON - MIN_LON)) * (COLS - 1)), Math.round(((a.lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (ROWS - 1))],
        toGrid: [Math.round(((b.lon - MIN_LON) / (MAX_LON - MIN_LON)) * (COLS - 1)), Math.round(((b.lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (ROWS - 1))],
      }, geometry: { type: "LineString", coordinates: coords } });
    }
  }
  return { ...META, type: "FeatureCollection", source: "OpenStreetMap via Overpass API", generated_at: new Date().toISOString(), features };
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
  const dem = await fetchDem();
  const [forcing, roads] = await Promise.all([fetchNoaa(), fetchRoads(dem.elevations)]);
  const landmarks = buildLandmarks(roads, dem.elevations);
  writeFileSync(join(OUT_DIR, "dem.json"), JSON.stringify(dem));
  writeFileSync(join(OUT_DIR, "forcing.json"), JSON.stringify(forcing, null, 2));
  writeFileSync(join(OUT_DIR, "roads.json"), JSON.stringify(roads));
  writeFileSync(join(OUT_DIR, "landmarks.json"), JSON.stringify(landmarks, null, 2));
  console.log(`Miami data written: ${dem.rows}x${dem.cols} DEM, ${roads.features.length} road edges, ${landmarks.features.length} landmarks, ${forcing.samples.length} hourly tide samples.`);
}

main().catch((err) => { console.error("generate-data failed:", err); process.exit(1); });
