/**
 * DEM (digital elevation model) access helpers.
 *
 * The grid is stored row-major with row 0 at the *southern* edge and column 0
 * at the *western* edge, so increasing row means increasing latitude and
 * increasing column means increasing longitude. Everything in this file is
 * pure and has no React or DOM dependency.
 */

import demJson from "../data/dem.json";

export interface BBox {
  lngMin: number;
  lngMax: number;
  latMin: number;
  latMax: number;
}

export interface Dem {
  name: string;
  /** [minLon, minLat, maxLon, maxLat] as written by the ingest script. */
  bounds?: number[];
  resolution_m?: number;
  datum?: string;
  location?: string;
  data_status?: string;
  bbox: BBox;
  cols: number;
  rows: number;
  /** Approximate ground distance between adjacent cell centres, in metres. */
  cellSizeM: number;
  minElevation: number;
  maxElevation: number;
  /** Metres relative to mean sea level, length = cols * rows. */
  elevations: number[];
}

/** Bundled Miami-Dade DEM. Production builds are refreshed by scripts/generate-data.ts. */
export const dem: Dem = demJson as Dem;

/** Elevations as a typed array — meaningfully faster in the flood-fill loop. */
export const elevations: Float32Array = Float32Array.from(dem.elevations);

export const CELL_COUNT = dem.cols * dem.rows;

/**
 * No-data marker written by the ingest script where USGS 3DEP has no bare
 * earth — chiefly open water. It sits far below any water level, so the flood
 * fill naturally treats these cells as submerged, which is correct. Road
 * sampling and depth readouts must exclude them: they are water, not ground.
 */
export const NO_DATA = -9000;
export const isNoData = (v: number) => v <= NO_DATA;

/** Flat index of a (row, col) cell. */
export const cellIndex = (row: number, col: number) => row * dem.cols + col;

/** Fractional column position of a longitude. May fall outside [0, cols-1]. */
export function lngToCol(lng: number): number {
  const { lngMin, lngMax } = dem.bbox;
  return ((lng - lngMin) / (lngMax - lngMin)) * (dem.cols - 1);
}

/** Fractional row position of a latitude. May fall outside [0, rows-1]. */
export function latToRow(lat: number): number {
  const { latMin, latMax } = dem.bbox;
  return ((lat - latMin) / (latMax - latMin)) * (dem.rows - 1);
}

/** Longitude of a column centre. */
export function colToLng(col: number): number {
  const { lngMin, lngMax } = dem.bbox;
  return lngMin + (col / (dem.cols - 1)) * (lngMax - lngMin);
}

/** Latitude of a row centre. */
export function rowToLat(row: number): number {
  const { latMin, latMax } = dem.bbox;
  return latMin + (row / (dem.rows - 1)) * (latMax - latMin);
}


/** Convert longitude/latitude to fractional Miami grid coordinates. */
export function latLonToGrid(lat: number, lng: number): { row: number; col: number } {
  return { row: latToRow(lat), col: lngToCol(lng) };
}

/** Convert fractional Miami grid coordinates back to latitude/longitude. */
export function gridToLatLon(row: number, col: number): { lat: number; lng: number } {
  return { lat: rowToLat(row), lng: colToLng(col) };
}

/**
 * Nearest cell index for a lng/lat, or -1 if the point is outside the DEM.
 * Used by the router to test whether a sampled point on a road is flooded.
 */
export function cellAt(lng: number, lat: number): number {
  const col = Math.round(lngToCol(lng));
  const row = Math.round(latToRow(lat));
  if (col < 0 || col >= dem.cols || row < 0 || row >= dem.rows) return -1;
  return cellIndex(row, col);
}

/**
 * Bilinearly interpolated elevation at a lng/lat. Falls back to the DEM
 * maximum outside the grid so out-of-bounds points are never "flooded".
 */
export function elevationAt(lng: number, lat: number): number {
  const fc = lngToCol(lng);
  const fr = latToRow(lat);
  if (fc < 0 || fc > dem.cols - 1 || fr < 0 || fr > dem.rows - 1) {
    return dem.maxElevation;
  }
  const c0 = Math.floor(fc);
  const r0 = Math.floor(fr);
  const c1 = Math.min(c0 + 1, dem.cols - 1);
  const r1 = Math.min(r0 + 1, dem.rows - 1);
  const tx = fc - c0;
  const ty = fr - r0;

  const e00 = elevations[cellIndex(r0, c0)];
  const e10 = elevations[cellIndex(r0, c1)];
  const e01 = elevations[cellIndex(r1, c0)];
  const e11 = elevations[cellIndex(r1, c1)];

  // Interpolating across a no-data cell would drag a real elevation towards
  // -9999. Fall back to the nearest valid corner instead.
  const corners = [e00, e10, e01, e11];
  if (corners.some(isNoData)) {
    const valid = corners.filter((v) => !isNoData(v));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : NO_DATA;
  }

  const top = e00 + (e10 - e00) * tx;
  const bottom = e01 + (e11 - e01) * tx;
  return top + (bottom - top) * ty;
}

const EARTH_R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two lng/lat points. */
export function haversine(
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
