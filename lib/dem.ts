import type { DemData } from './types';

export function getElevationAt(dem: DemData, lon: number, lat: number): number {
  if (!dem || !dem.elevation || !dem.bounds) return 0;
  const [minLon, minLat, maxLon, maxLat] = dem.bounds;

  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    return 0;
  }

  const xNorm = (lon - minLon) / (maxLon - minLon);
  const yNorm = 1 - (lat - minLat) / (maxLat - minLat);

  const col = Math.min(dem.width - 1, Math.max(0, Math.floor(xNorm * dem.width)));
  const row = Math.min(dem.height - 1, Math.max(0, Math.floor(yNorm * dem.height)));

  const idx = row * dem.width + col;
  return dem.elevation[idx] ?? 0;
}

export function sampleSlope(dem: DemData, lon: number, lat: number): number {
  const delta = 0.001;
  const eCenter = getElevationAt(dem, lon, lat);
  const eEast = getElevationAt(dem, lon + delta, lat);
  const eNorth = getElevationAt(dem, lon, lat + delta);

  const dx = eEast - eCenter;
  const dy = eNorth - eCenter;
  return Math.sqrt(dx * dx + dy * dy);
}
