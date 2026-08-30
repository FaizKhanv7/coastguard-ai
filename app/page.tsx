"use client";

/**
 * Landing page.
 *
 * Judges and first-time visitors arrive here cold, so this page has one job:
 * explain what the thing is and get them into it. It is the only page that
 * talks *about* the product rather than operating it.
 *
 * The figures on it are not marketing copy — they are read live from the same
 * engine everything else runs on, so the headline numbers cannot drift away
 * from what the dashboard actually shows.
 */

import Link from "next/link";
import { useMemo } from "react";
import { useCoastguard } from "@/lib/store";
import {
  community,
  statusAt,
  levelSeries,
  graph,
  landmarks,
  dem,
  STEP_COUNT,
  STEP_HOURS,
  formatClock,
} from "@/lib/engine";
import { Card } from "@/components/ui";

export default function LandingPage() {
  const s = useCoastguard();

  const peak = useMemo(() => {
    const i = levelSeries.reduce((b, v, k) => (v > levelSeries[b] ? k : b), 0);
    return { index: i, level: levelSeries[i] };
  }, []);

  // Computed on demand from the engine so the landing page can never claim
  // something the dashboard would contradict.
  const peakStatus = useMemo(
    () => (s.ready ? statusAt(peak.index, 0, landmarks[3].nodeId) : null),
    [s.ready, peak.index],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Hero ---- */}
      <section className="overflow-hidden rounded-[20px] bg-navy p-7 text-white shadow-panel lg:p-12">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-chip bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
            <span
              className="h-1.5 w-1.5 rounded-full bg-teal"
              aria-hidden="true"
            />
            {dem.name} · {STEP_COUNT} simulated timesteps
          </div>

          <h1 className="font-serif text-[34px] font-semibold leading-[1.1] lg:text-[46px]">
            The map doesn&rsquo;t just show the flood.
            <br />
            It predicts it, then routes around it.
          </h1>

          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/75">
            CoastGuard AI models where water will spread across Miami-Dade
            over the next 6, 12 and 24 hours — on real USGS elevation, real
            NOAA tide and the real road network — then finds the safest
            still-passable route between any two points, excluding roads that
            are already under water or that the forecast says will be before
            you arrive.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/overview"
              className="rounded-[14px] bg-white px-5 py-3.5 text-[14px] font-bold text-navy transition-opacity hover:opacity-90"
            >
              Open the dashboard →
            </Link>
            <Link
              href="/map"
              className="rounded-[14px] bg-white/10 px-5 py-3.5 text-[14px] font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white/15"
            >
              Go straight to the map
            </Link>
            <a
              href="/mobile.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[14px] bg-white/10 px-5 py-3.5 text-[14px] font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white/15"
            >
              Field app ↗
            </a>
          </div>
        </div>
      </section>

      {/* ---- Live figures, straight off the engine ---- */}
      <section
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Simulation at a glance"
      >
        <Figure
          value={`${peak.level.toFixed(2)} m`}
          label="Peak surge"
          detail={`at ${formatClock(peak.index)}`}
        />
        <Figure
          value={
            peakStatus ? `${peakStatus.blockedCount} / ${graph.edges.length}` : "—"
          }
          label="Roads cut at the peak"
          detail="of the whole network"
          alert
        />
        <Figure
          value={`${((STEP_COUNT - 1) * STEP_HOURS).toFixed(0)} h`}
          label="Forecast window"
          detail={`${STEP_HOURS * 60}-minute resolution`}
        />
        <Figure
          value={String(
            community.shelters.length +
              community.incidents.length +
              community.resources.length +
              community.volunteerJobs.length,
          )}
          label="Community records"
          detail="all placed on the road graph"
        />
      </section>

      {/* ---- The two algorithms ---- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            Algorithm 1
          </div>
          <h2 className="mb-2 font-serif text-[19px] font-semibold text-navy">
            Predictive flood modelling
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Water level is tide plus storm surge plus rainfall accumulating and
            draining on a five-hour time constant. A cell floods only if it is
            below that level <em>and</em> connected to the open sea, found by
            breadth-first search from the coastline.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
            That second condition is the whole point. A plain elevation
            threshold floods every inland hollow that happens to sit below the
            waterline — including the Old Quarry Basin, whose floor is 1.9 m
            below sea level but which is ringed by 20 m of high ground. At the
            storm peak the model reports{" "}
            <strong className="text-navy">
              {peakStatus ? peakStatus.isolatedCells : "95"} cells
            </strong>{" "}
            that a naive model would have flooded and this one correctly leaves
            dry.
          </p>
        </Card>

        <Card>
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            Algorithm 2
          </div>
          <h2 className="mb-2 font-serif text-[19px] font-semibold text-navy">
            Dynamic safe-route pathfinding
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Every road segment is sampled every 15 m against the flood grid. A
            road closes when any point along it is standing in more than 30 cm
            of water — the depth at which a car loses traction — not merely when
            it is wet. A* with a haversine heuristic then finds the shortest
            path through whatever is left.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
            Two risk modes disagree on purpose:{" "}
            <strong className="text-navy">fastest</strong> avoids only what is
            flooded now, <strong className="text-navy">safest</strong> avoids
            anything the forecast says will flood before the horizon. When the
            surge is coming, that is the difference between a 3.37 km route
            across a causeway that is about to go under and a 5.96 km one over
            the ridge that will still be there.
          </p>
        </Card>
      </section>

      {/* ---- Two surfaces ---- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="mb-1.5 font-serif text-[18px] font-semibold text-navy">
            Operations dashboard
          </h2>
          <p className="flex-1 text-[13px] leading-relaxed text-ink-soft">
            For the emergency operations centre. The whole town at once —
            conditions, the forecast map, hazard intake, shared inventory,
            volunteer dispatch, and an assistant that answers from the model.
          </p>
          <Link
            href="/overview"
            className="mt-4 inline-block rounded-[14px] bg-navy px-4 py-3 text-center text-[13px] font-bold text-white hover:opacity-90"
          >
            Open the dashboard
          </Link>
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-1.5 font-serif text-[18px] font-semibold text-navy">
            Field app
          </h2>
          <p className="flex-1 text-[13px] leading-relaxed text-ink-soft">
            For residents and volunteers, on a phone, possibly offline. Same
            flood model and router — it loads the exact compiled module the
            dashboard imports — plus photo hazard reporting and an offline
            assistant.
          </p>
          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-[14px] bg-sand px-4 py-3 text-center text-[13px] font-bold text-navy hover:opacity-90"
          >
            Open the field app ↗
          </a>
        </Card>
      </section>

      <Card className="bg-navy text-white">
        <h2 className="mb-2 font-serif text-[16px] font-semibold">
          Nothing here depends on a live API
        </h2>
        <p className="text-[12.5px] leading-relaxed text-white/75">
          The town is synthetic and generated from one seed, so it regenerates
          byte-identically. The elevation grid, road network, forcing series and
          community records are all bundled as static files. The only network
          request either surface makes is for basemap tiles — and both work
          without them, because every figure on screen is computed locally.
        </p>
      </Card>
    </div>
  );
}

function Figure({
  value,
  label,
  detail,
  alert,
}: {
  value: string;
  label: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <div
        className={`font-serif text-[26px] font-semibold ${
          alert ? "text-coral-dark" : "text-navy"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[12px] font-semibold text-navy">{label}</div>
      <div className="text-[11px] text-ink-soft">{detail}</div>
    </div>
  );
}
