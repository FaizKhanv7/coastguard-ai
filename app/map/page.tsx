"use client";

/**
 * The forecast map — the flood model, the timeline and the router.
 *
 * This used to be the whole app. It is now one page of several, but it is
 * still where the two algorithms are on display, so it keeps the full
 * treatment: horizon toggles, the 48 h scrubber, the risk-mode comparison and
 * the legend.
 */

import dynamic from "next/dynamic";
import { useCoastguard, type Horizon } from "@/lib/store";
import { HORIZONS } from "@/lib/engine";
import { Card, Segmented } from "@/components/ui";
import TimeScrubber from "@/components/TimeScrubber";
import StatusPanel from "@/components/StatusPanel";
import RoutePanel from "@/components/RoutePanel";
import LegendBar from "@/components/LegendBar";

// MapLibre touches `window` on import, so it must not be server-rendered.
const FloodMap = dynamic(() => import("@/components/FloodMap"), {
  ssr: false,
  loading: () => <MapSkeleton label="Loading map…" />,
});

export default function MapPage() {
  const s = useCoastguard();
  const cutOffIds = new Set(s.status.cutOff.map((c) => c.id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="flex flex-col gap-4" aria-label="Flood map">
        <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-[20px] shadow-panel lg:h-[calc(100vh-300px)]">
          {s.ready ? (
            <FloodMap
              displayed={s.displayed}
              blockedEdges={s.blockedEdges}
              route={s.route}
              comparison={s.comparison}
              originId={s.originId}
              destId={s.destId}
              cutOffIds={cutOffIds}
              onPickLandmark={(id) => {
                if (id === s.originId || id === s.destId) return;
                s.setDestId(id);
              }}
            />
          ) : (
            <MapSkeleton label="Precomputing the flood model…" />
          )}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            <div className="pointer-events-auto rounded-chip bg-card/95 p-1 shadow-card backdrop-blur">
              <Segmented
                name="horizon"
                label="Forecast horizon"
                value={s.horizon}
                onChange={(h) => s.setHorizon(h as Horizon)}
                options={HORIZONS.map((h) => ({
                  value: h,
                  label: h === 0 ? "Now" : `+${h}h`,
                  hint:
                    h === 0
                      ? "current flood extent"
                      : `flood extent projected ${h} hours ahead`,
                }))}
              />
            </div>
          </div>
        </div>

        <TimeScrubber
          step={s.step}
          onStep={s.setStep}
          playing={s.playing}
          onTogglePlay={s.togglePlay}
          waterLevelM={s.current.waterLevelM}
          horizon={s.horizon}
          displayedLevelM={s.displayed.waterLevelM}
        />

        <LegendBar />
      </section>

      <section
        className="flex flex-col gap-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1"
        aria-label="Conditions and routing"
      >
        <StatusPanel
          displayed={s.displayed}
          horizon={s.horizon}
          blockedCount={s.blockedEdges.size}
          cutOff={s.status.cutOff}
          floodedFraction={s.status.floodedFraction}
        />
        <RoutePanel
          originId={s.originId}
          destId={s.destId}
          onOrigin={s.setOriginId}
          onDest={s.setDestId}
          onSwap={s.swapEnds}
          mode={s.mode}
          onMode={s.setMode}
          horizon={s.horizon}
          route={s.route}
          comparison={s.comparison}
        />
        <ModelNote />
      </section>
    </div>
  );
}

function MapSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-sand-dim"
      role="status"
    >
      <div className="text-[12px] font-semibold text-ink-soft">{label}</div>
      <p className="max-w-xs px-6 text-center text-[11px] leading-relaxed text-ink-soft">
        Running the connectivity flood fill across all 193 timesteps up front,
        so scrubbing the timeline never has to re-simulate.
      </p>
    </div>
  );
}

function ModelNote() {
  return (
    <Card className="bg-navy text-white">
      <h3 className="mb-2 font-serif text-[15px] font-semibold">How this works</h3>
      <ol className="space-y-2 text-[11.5px] leading-relaxed text-white/80">
        <li>
          <strong className="text-white">1 · Flood model.</strong> Water level
          is tide plus storm surge plus accumulated rainfall draining away on a
          5-hour time constant. A cell floods only if it is below that level{" "}
          <em>and</em> connected to the open sea, found by breadth-first search
          from the coast.
        </li>
        <li>
          <strong className="text-white">2 · Safe routing.</strong> Each road
          segment is sampled every 15 m against the flood grid; anything
          standing in more than 30 cm of water is dropped from the graph. A*
          with a haversine heuristic then finds the shortest path through what
          is left.
        </li>
      </ol>
      <p className="mt-3 border-t border-white/15 pt-2.5 text-[11px] text-white/60">
        The field app runs this exact engine — same numbers, same hour.
      </p>
    </Card>
  );
}
