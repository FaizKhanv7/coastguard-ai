"use client";

/**
 * Origin/destination pickers, the risk-tolerance switch, and the result —
 * distance, ETA, warnings, or an actionable message when no route exists.
 */

import { Card, Pill, SectionTitle, Segmented } from "./ui";
import {
  landmarks,
  type RiskTolerance,
  type RouteResult,
} from "@/lib/routing";

interface Props {
  originId: string;
  destId: string;
  onOrigin: (id: string) => void;
  onDest: (id: string) => void;
  onSwap: () => void;
  mode: RiskTolerance;
  onMode: (m: RiskTolerance) => void;
  horizon: number;
  route: RouteResult;
  comparison: RouteResult;
}

const selectClass =
  "w-full cursor-pointer rounded-[12px] border border-sand-dim bg-sand px-3 py-2.5 text-[13px] font-semibold text-navy";

export default function RoutePanel({
  originId,
  destId,
  onOrigin,
  onDest,
  onSwap,
  mode,
  onMode,
  horizon,
  route,
  comparison,
}: Props) {
  const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
  const mins = (m: number) => `${Math.round(m)} min`;

  // One line per road, not per segment — a road made of four segments that
  // all flood should read as one warning, not four.
  const uniqueWarnings = route.ok
    ? [...new Map(route.warnings.map((w) => [w.roadName, w])).values()]
    : [];

  return (
    <Card>
      <SectionTitle>Safe route</SectionTitle>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
            From
          </span>
          <select
            className={selectClass}
            value={originId}
            onChange={(e) => onOrigin(e.target.value)}
          >
            {landmarks.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onSwap}
          aria-label="Swap origin and destination"
          className="mb-1 h-9 w-9 cursor-pointer rounded-full border border-sand-dim bg-card text-[14px] text-ink-soft shadow-card hover:text-navy"
        >
          ⇄
        </button>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
            To
          </span>
          <select
            className={selectClass}
            value={destId}
            onChange={(e) => onDest(e.target.value)}
          >
            {landmarks.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
          Risk tolerance
        </span>
        <Segmented
          name="risk"
          label="Risk tolerance"
          value={mode}
          onChange={onMode}
          options={[
            {
              value: "fastest" as const,
              label: "Fastest",
              hint: "avoids only roads flooded right now",
            },
            {
              value: "safest" as const,
              label: "Safest",
              hint: `avoids any road predicted to flood within ${horizon} hours`,
            },
          ]}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
        {mode === "safest"
          ? `Excluding every road the model expects to go under within ${horizon} h.`
          : "Excluding only roads that are under water at this moment."}
      </p>

      <div className="mt-3.5 border-t border-sand-dim pt-3.5" aria-live="polite">
        {route.ok ? (
          <>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  Distance
                </div>
                <div className="font-serif text-2xl font-semibold text-navy">
                  {km(route.distanceM)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  Drive time
                </div>
                <div className="font-serif text-2xl font-semibold text-navy">
                  {mins(route.etaMinutes)}
                </div>
              </div>
              <div className="ml-auto">
                {uniqueWarnings.length === 0 ? (
                  <Pill tone="teal">Clear</Pill>
                ) : (
                  <Pill tone="coral">
                    {uniqueWarnings.length} at risk
                  </Pill>
                )}
              </div>
            </div>

            {uniqueWarnings.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {uniqueWarnings.map((w) => (
                  <li
                    key={w.edgeId}
                    className="flex gap-2 rounded-[12px] bg-coral-tint px-3 py-2 text-[11.5px] font-semibold leading-snug text-coral-dark"
                  >
                    <span aria-hidden="true">⚠</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            )}

            {comparison.ok && comparison.distanceM !== route.distanceM && (
              <p className="mt-3 rounded-[12px] bg-amber-tint px-3 py-2 text-[11.5px] font-semibold leading-snug text-amber-dark">
                <span aria-hidden="true">┄ </span>
                {mode === "safest"
                  ? `The fastest route is ${km(comparison.distanceM)} — ${km(route.distanceM - comparison.distanceM)} shorter, but it uses roads the model expects to flood.`
                  : `The safest route is ${km(comparison.distanceM)} — ${km(comparison.distanceM - route.distanceM)} further, but it stays clear of the projected flood.`}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-[14px] bg-coral-tint p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-[13px] font-bold text-white"
                aria-hidden="true"
              >
                !
              </span>
              <strong className="font-serif text-[15px] text-coral-dark">
                No safe route
              </strong>
            </div>
            <p className="text-[12px] leading-relaxed text-coral-dark">
              {route.message}
            </p>

            {route.nearestReachable && (
              <div className="mt-3 rounded-[12px] bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  Nearest place you can still reach
                </div>
                <div className="mt-0.5 font-serif text-[15px] font-semibold text-navy">
                  {route.nearestReachable.landmark.name}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-soft">
                  {km(route.nearestReachable.distanceM)} ·{" "}
                  {mins(route.nearestReachable.etaMinutes)} · ground level{" "}
                  {route.nearestReachable.landmark.elevation.toFixed(1)} m
                </div>
                <p className="mt-1.5 text-[11px] text-ink-soft">
                  Shown on the map as a dashed blue line.
                </p>
              </div>
            )}

            {comparison.ok && (
              <p className="mt-3 rounded-[12px] bg-card px-3 py-2 text-[11.5px] leading-snug text-ink-soft">
                A <strong className="text-navy">{comparison.mode}</strong> route
                does exist ({km(comparison.distanceM)}), but it runs through
                ground the model expects to be under water.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
