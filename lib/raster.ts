/**
 * Renders a FloodState into a small PNG that MapLibre draws as an image
 * overlay stretched across the DEM's bounding box.
 *
 * Why a raster rather than GeoJSON polygons: the flood mask is a 160x160 grid,
 * and tracing it into vector rings every timestep would be both slow and
 * fiddly. One 160x160 image is a single texture upload, and the colour ramp
 * gives us water *depth* for free — something a binary polygon could not show.
 */

import { dem, elevations, CELL_COUNT } from "./dem";
import type { FloodState } from "./flood";

/** Depth in metres at which the overlay reaches its darkest blue. */
const MAX_SHADE_DEPTH = 2.5;

/**
 * Diagonal hatching period, in cells. Flooded area is marked by BOTH a colour
 * and this texture, so the overlay still reads as "under water" for a viewer
 * who cannot distinguish it by hue.
 */
const HATCH_PERIOD = 7;
const HATCH_WIDTH = 2;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let imageData: ImageData | null = null;

function ensureCanvas() {
  if (canvas && ctx && imageData) return { canvas, ctx, imageData };
  canvas = document.createElement("canvas");
  canvas.width = dem.cols;
  canvas.height = dem.rows;
  ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  imageData = ctx.createImageData(dem.cols, dem.rows);
  return { canvas, ctx, imageData };
}

/**
 * Paints the flood mask into a data URL.
 *
 * Note the vertical flip: DEM row 0 is the *southern* edge, but canvas row 0
 * is the top of the image, which is the *northern* edge.
 */
export function renderFloodImage(state: FloodState): string {
  const { canvas, ctx, imageData } = ensureCanvas();
  const { cols, rows } = dem;
  const px = imageData.data;

  for (let i = 0; i < CELL_COUNT; i++) {
    const row = (i / cols) | 0;
    const col = i - row * cols;
    // Flip vertically into image space.
    const out = ((rows - 1 - row) * cols + col) * 4;

    if (!state.flooded[i]) {
      px[out + 3] = 0; // fully transparent where dry
      continue;
    }

    const depth = Math.max(0, state.waterLevelM - elevations[i]);
    const t = Math.min(1, depth / MAX_SHADE_DEPTH);

    // Ramp from the mockup's pale blue tint to its deep blue.
    // #7FB3CE -> #1D4A62
    const r = Math.round(127 + (29 - 127) * t);
    const g = Math.round(179 + (74 - 179) * t);
    const b = Math.round(206 + (98 - 206) * t);

    // Diagonal hatch: a darker stripe every HATCH_PERIOD cells. Redundant
    // with colour on purpose — see the note at the top of the file.
    const onHatch = (row + col) % HATCH_PERIOD < HATCH_WIDTH;
    const shade = onHatch ? 0.72 : 1;

    px[out] = Math.round(r * shade);
    px[out + 1] = Math.round(g * shade);
    px[out + 2] = Math.round(b * shade);
    // Shallow water is more transparent, so the road network stays readable
    // where it is only just awash.
    px[out + 3] = Math.round(150 + 85 * t);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Corner coordinates for MapLibre's image source, in the order it expects:
 * top-left, top-right, bottom-right, bottom-left.
 */
export const floodImageCoordinates: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [dem.bbox.lngMin, dem.bbox.latMax],
  [dem.bbox.lngMax, dem.bbox.latMax],
  [dem.bbox.lngMax, dem.bbox.latMin],
  [dem.bbox.lngMin, dem.bbox.latMin],
];
