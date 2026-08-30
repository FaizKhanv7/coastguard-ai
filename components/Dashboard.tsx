"use client";

/**
 * The map centrepiece: OSM raster basemap, flood overlay, road network
 * coloured by passability, the two candidate routes, and landmark markers.
 *
 * Every layer that carries meaning is encoded twice — colour plus either a
 * dash pattern, a texture or a label — so nothing critical is lost to a
 * viewer who cannot separate the hues.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FeatureCollection, LineString, Feature } from "geojson";

import { dem } from "@/lib/dem";
import { graph, landmarks, shortName, type RouteResult } from "@/lib/routing";
import type { FloodState } from "@/lib/flood";
import { renderFloodImage, floodImageCoordinates } from "@/lib/raster";

const INITIAL_VIEW = {
  longitude: -80.1936,
  latitude: 25.7740,
  zoom: 13,
};

/** The town's extent, used to frame the map once the container is sized. */
const TOWN_BOUNDS: [[number, number], [number, number]] = [
  [dem.bbox.lngMin, dem.bbox.latMin],
  [dem.bbox.lngMax, dem.bbox.latMax],
];

/** Free raster basemap — no API key, which keeps the demo offline-safe. */
const BASEMAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      paint: { "raster-opacity": 0.55, "raster-saturation": -0.4 },
    },
  ],
};

const ICONS: Record<string, string> = { hospital: "H", shelter: "S", uscg: "C", depot: "D", evacuation: "E", fire: "F", checkpoint: "P", causeway: "R" };

const KIND_COLOR: Record<string, string> = { hospital: "var(--color-coral)", shelter: "var(--color-blue)", uscg: "var(--color-navy)", depot: "var(--color-teal)", evacuation: "var(--color-amber)", fire: "var(--color-coral)", checkpoint: "var(--color-blue)", causeway: "var(--color-amber)" };

interface Props {
  displayed: FloodState;
  blockedEdges: Set<string>;
  route: RouteResult;
  comparison: RouteResult;
  originId: string;
  destId: string;
  cutOffIds: Set<string>;
  onPickLandmark: (id: string) => void;
}

export default function FloodMap({
  displayed,
  blockedEdges,
  route,
  comparison,
  originId,
  destId,
  cutOffIds,
  onPickLandmark,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [floodUrl, setFloodUrl] = useState<string | null>(null);

  /** Set once the operator pans or zooms, so we stop re-framing on them. */
  const userMoved = useRef(false);

  const fitTown = useCallback(() => {
    mapRef.current?.fitBounds(TOWN_BOUNDS, { padding: 28, duration: 0 });
  }, []);

  // MapLibre sizes its canvas once at construction. This dashboard mounts the
  // map behind a loading skeleton and sits in a responsive grid, so the
  // container almost always changes size after that — without this observer
  // the canvas keeps whatever size it happened to be born with.
  //
  // Re-fitting after the resize matters just as much: `resize()` preserves
  // centre and zoom, so a map first framed in a small container and then
  // grown keeps the tighter zoom and leaves the town as a small square in
  // the middle of a much wider view. We stop doing it the moment the
  // operator moves the map themselves.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
      if (!userMoved.current) fitTown();
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [fitTown]);

  // Frame the whole town once the style is up and the container is laid out.
  const handleLoad = useCallback(() => fitTown(), [fitTown]);

  // `originalEvent` is only present when a human drove the movement, which is
  // how we tell an operator pan apart from our own fitBounds call.
  const handleMoveStart = useCallback(
    (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userMoved.current = true;
    },
    [],
  );

  // Repaint the flood raster whenever the displayed timestep changes.
  useEffect(() => {
    setFloodUrl(renderFloodImage(displayed));
  }, [displayed]);

  // Road network, split into passable and impassable collections so each can
  // carry its own paint. Rebuilt only when the closure set changes.
  const { openRoads, blockedRoads } = useMemo(() => {
    const open: Feature<LineString>[] = [];
    const blocked: Feature<LineString>[] = [];
    for (const edge of graph.edges) {
      const feature: Feature<LineString> = {
        type: "Feature",
        properties: { name: edge.name, id: edge.id },
        geometry: { type: "LineString", coordinates: edge.coordinates },
      };
      (blockedEdges.has(edge.id) ? blocked : open).push(feature);
    }
    return {
      openRoads: { type: "FeatureCollection", features: open } as FeatureCollection,
      blockedRoads: {
        type: "FeatureCollection",
        features: blocked,
      } as FeatureCollection,
    };
  }, [blockedEdges]);

  const routeLine = useMemo(() => toLine(route), [route]);
  const comparisonLine = useMemo(() => toLine(comparison), [comparison]);
  const fallbackLine = useMemo(
    () =>
      !route.ok && route.nearestReachable
        ? lineFrom(route.nearestReachable.coordinates)
        : null,
    [route],
  );

  return (
    <div ref={shellRef} className="h-full w-full">
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle={BASEMAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      dragRotate={false}
      touchPitch={false}
      onLoad={handleLoad}
      onMoveStart={handleMoveStart}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Flood extent. Depth-shaded and diagonally hatched. */}
      {floodUrl && (
        <Source
          id="flood"
          type="image"
          url={floodUrl}
          coordinates={floodImageCoordinates}
        >
          <Layer id="flood-layer" type="raster" paint={{ "raster-opacity": 0.82 }} />
        </Source>
      )}

      {/* Passable roads: thin, solid, neutral. */}
      <Source id="roads-open" type="geojson" data={openRoads}>
        <Layer
          id="roads-open-layer"
          type="line"
          paint={{
            "line-color": "#3C4A46",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 16, 2.6],
            "line-opacity": 0.75,
          }}
        />
      </Source>

      {/* Impassable roads: coral AND dashed, so the closure reads without
          relying on the colour difference alone. */}
      <Source id="roads-blocked" type="geojson" data={blockedRoads}>
        <Layer
          id="roads-blocked-casing"
          type="line"
          paint={{
            "line-color": "#FFFFFF",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
            "line-opacity": 0.55,
          }}
        />
        <Layer
          id="roads-blocked-layer"
          type="line"
          paint={{
            "line-color": "#E2572B",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.8, 16, 4],
            "line-dasharray": [1.5, 1.2],
          }}
        />
      </Source>

      {/* The other risk mode's route, drawn behind as a dashed comparison. */}
      {comparisonLine && (
        <Source id="route-compare" type="geojson" data={comparisonLine}>
          <Layer
            id="route-compare-layer"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#E3A008",
              "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
              "line-dasharray": [2, 1.6],
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* The selected route. */}
      {routeLine && (
        <Source id="route" type="geojson" data={routeLine}>
          <Layer
            id="route-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#FFFFFF",
              "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 12],
            }}
          />
          <Layer
            id="route-layer"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#1F8A70",
              "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 16, 8],
            }}
          />
        </Source>
      )}

      {/* Suggested alternative when the requested destination is unreachable. */}
      {fallbackLine && (
        <Source id="route-fallback" type="geojson" data={fallbackLine}>
          <Layer
            id="route-fallback-layer"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#2E6F95",
              "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
              "line-dasharray": [1, 1.4],
            }}
          />
        </Source>
      )}

      {landmarks.map((lm) => {
        const isOrigin = lm.id === originId;
        const isDest = lm.id === destId;
        const isCut = cutOffIds.has(lm.id);
        return (
          <Marker
            key={lm.id}
            longitude={lm.lng}
            latitude={lm.lat}
            anchor="center"
          >
            <button
              type="button"
              onClick={() => onPickLandmark(lm.id)}
              className="flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0"
              aria-label={
                `${lm.name}, ground level ${lm.elevation.toFixed(1)} metres` +
                (isCut ? ", currently cut off" : "") +
                (isOrigin ? ", selected as origin" : "") +
                (isDest ? ", selected as destination" : "")
              }
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
                style={{
                  background: isCut ? "#9E3A18" : KIND_COLOR[lm.kind],
                  outline:
                    isOrigin || isDest ? "3px solid #0E2A33" : undefined,
                  outlineOffset: 1,
                }}
              >
                {ICONS[lm.kind] ?? "•"}
              </span>
              <span className="whitespace-nowrap rounded-full bg-white/92 px-1.5 py-px text-[9px] font-bold text-navy shadow-sm">
                {isOrigin ? "FROM · " : isDest ? "TO · " : ""}
                {shortName(lm)}
                {isCut ? " ⚠" : ""}
              </span>
            </button>
          </Marker>
        );
      })}
    </Map>
    </div>
  );
}

function lineFrom(coordinates: [number, number][]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      },
    ],
  };
}

function toLine(result: RouteResult): FeatureCollection | null {
  return result.ok ? lineFrom(result.coordinates) : null;
}


components/Dashboard.tsx

"use client";

import Link from "next/link";
import { useCoastguard } from "@/lib/store";

const ZONES = [
  "Brickell Core",
  "South Beach / MacArthur",
  "PortMiami Access",
  "Miami River Corridor",
];

export default function Dashboard() {
  const { status, ready } = useCoastguard();
  return (
    <section className="fastshot-stage" aria-label="Miami flood operations dashboard">
      <div className="fastshot-frame">
        <header className="fastshot-nav">
          <Link href="/" className="fastshot-brand" aria-label="CoastGuard AI home">
            <span className="fastshot-mark" aria-hidden="true"><i /></span>
            <span>CoastGuard AI</span>
          </Link>
          <nav className="fastshot-links" aria-label="Operations">
            <Link href="/map">Live Map</Link><Link href="/resources">Assets</Link><Link href="/assistant">Assistant</Link>
          </nav>
          <Link href="/map" className="fastshot-cta">Open map</Link>
        </header>

        <main className="fastshot-hero">
          <div className="fastshot-eyebrow">Miami-Dade Coastal Metro · NAVD88</div>
          <h1>Flood response, in one view.</h1>
          <div className="fastshot-card">
            <div className="fastshot-status">
              <div><span>Water</span><strong>{ready ? `${status.waterLevelM.toFixed(2)} m` : "—"}</strong></div>
              <div><span>Roads cut</span><strong>{ready ? status.blockedCount : "—"}</strong></div>
              <div><span>Locations cut off</span><strong>{ready ? status.cutOff.length : "—"}</strong></div>
            </div>
            <div className="fastshot-tools">
              <div className="fastshot-zones" aria-label="Dispatch zone presets">
                {ZONES.map((zone) => <Link key={zone} href="/map" className="fastshot-chip">{zone}</Link>)}
              </div>
              <div className="fastshot-right">
                <span>Virginia Key · 8723214</span>
                <Link href="/map" className="fastshot-send" aria-label="Open operational map">↑</Link>
              </div>
            </div>
          </div>
        </main>

        <footer className="fastshot-proof">
          <p>Authoritative feeds</p><div><span>USGS 3DEP</span><span>NOAA CO-OPS</span><span>OpenStreetMap</span></div>
        </footer>
      </div>
    </section>
  );
}
