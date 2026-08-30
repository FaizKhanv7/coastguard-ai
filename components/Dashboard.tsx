"use client";

/**
 * Desktop-first two-column shell: the map takes the space, the panels sit in
 * a rail beside it, and the timeline runs under the map. Below the `lg`
 * breakpoint the whole thing stacks into one scrolling column, which is the
 * layout the original phone mockup was drawn for.
 */

import dynamic from "next/dynamic";
import { HORIZONS, useCoastguard, type Horizon } from "@/lib/useCoastguard";
import { Card, Segmented } from "./ui";
import TimeScrubber from "./TimeScrubber";
import StatusPanel from "./StatusPanel";
import RoutePanel from "./RoutePanel";
import LegendBar from "./LegendBar";

// MapLibre touches `window` on import, so it must not be server-rendered.
const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => <MapSkeleton label="Loading map…" />,
});

export default function Dashboard() {
  const s = useCoastguard();
  const cutOffIds = new Set(s.cutOff.map((c) => c.id));

  return (
    <div className="min-h-screen bg-sand">
      <Header
        waterLevelM={s.displayed.waterLevelM}
        blocked={s.blockedEdges.size}
        cutOff={s.cutOff.length}
        horizon={s.horizon}
      />

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-3 pb-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-5">
        {/* ---- Map column ---- */}
        <section className="flex flex-col gap-4" aria-label="Flood map">
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-[20px] shadow-panel lg:h-[calc(100vh-268px)]">
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
                  // Click cycles a landmark through origin, then destination.
                  if (id === s.originId || id === s.destId) return;
                  s.setDestId(id);
                }}
              />
            ) : (
              <MapSkeleton
                label="Precomputing the flood model…"
                progress={s.progress}
              />
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

        {/* ---- Panel rail ---- */}
        <section
          className="flex flex-col gap-4 lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto lg:pr-1"
          aria-label="Conditions and routing"
        >
          <StatusPanel
            displayed={s.displayed}
            horizon={s.horizon}
            blockedCount={s.blockedEdges.size}
            cutOff={s.cutOff}
            floodedFraction={s.floodedFraction}
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
      </main>
    </div>
  );
}

function Header({
  waterLevelM,
  blocked,
  cutOff,
  horizon,
}: {
  waterLevelM: number;
  blocked: number;
  cutOff: number;
  horizon: number;
}) {
  // These figures describe whichever moment the map is showing, which is the
  // scrubbed time plus the forecast horizon. Saying so explicitly matters:
  // without it the header reads 0.82 m while the scrubber right below reads
  // 3.66 m, and the two look like they are contradicting each other.
  const projected = horizon > 0;
  return (
    <header className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-4 lg:px-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Kalinaw Island
        </div>
        <h1 className="font-serif text-[22px] font-semibold text-navy">
          CoastGuard AI
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="mr-1 text-right">
          <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-soft">
            Showing
          </div>
          <div
            className={`rounded-chip px-2 py-0.5 text-[11px] font-bold ${
              projected
                ? "bg-amber-tint text-amber-dark"
                : "bg-teal-tint text-teal-dark"
            }`}
          >
            {projected ? `Forecast +${horizon} h` : "Live now"}
          </div>
        </div>
        <HeaderStat label="Water" value={`${waterLevelM.toFixed(2)} m`} />
        <HeaderStat label="Roads cut" value={String(blocked)} />
        <HeaderStat
          label="Places cut off"
          value={String(cutOff)}
          alert={cutOff > 0}
        />
      </div>
    </header>
  );
}

function HeaderStat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] px-3 py-2 text-center shadow-card ${
        alert ? "bg-coral-tint" : "bg-card"
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </div>
      <div
        className={`font-serif text-[15px] font-semibold ${
          alert ? "text-coral-dark" : "text-navy"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MapSkeleton({
  label,
  progress,
}: {
  label: string;
  progress?: number;
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-sand-dim"
      role="status"
    >
      <div className="text-[12px] font-semibold text-ink-soft">{label}</div>
      {progress !== undefined && (
        <div className="h-1.5 w-52 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full bg-teal transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
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
      <h3 className="mb-2 font-serif text-[15px] font-semibold">
        How this works
      </h3>
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
        All data is synthetic and bundled locally — no network calls at
        runtime.
      </p>
    </Card>
  );
}
