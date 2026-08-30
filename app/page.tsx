"use client";

/**
 * Home — the operations overview.
 *
 * Deliberately shaped like the field app's home screen: conditions, outlook,
 * a safety score, where to send people, and what is happening right now. The
 * difference is scale — the field app answers "what should I do", this
 * answers "what is happening to the town".
 */

import Link from "next/link";
import { useMemo } from "react";
import { useCoastguard } from "@/lib/store";
import {
  community,
  statusAt,
  floodDepthAt,
  HORIZONS,
  formatClock,
  shortName,
} from "@/lib/engine";
import { Card, Pill, SectionTitle, Stat } from "@/components/ui";

const SEVERITY_LABEL = {
  normal: { text: "Normal conditions", tone: "teal" as const },
  elevated: { text: "Elevated tide", tone: "blue" as const },
  flooding: { text: "Flooding", tone: "amber" as const },
  severe: { text: "Severe flooding", tone: "coral" as const },
};

export default function HomePage() {
  const s = useCoastguard();
  const { status, step, horizon, ready } = s;

  const outlook = useMemo(
    () => HORIZONS.map((h) => ({ h, st: statusAt(step, h, s.originNodeId) })),
    [step, s.originNodeId],
  );

  const worst = outlook.reduce((a, b) =>
    b.st.waterLevelM > a.st.waterLevelM ? b : a,
  );

  const incidentRows = s.reach(s.incidents).slice(0, 4);
  const resourceRows = s.reach(s.resources).slice(0, 4);

  /**
   * A single readable number for "how is the town doing", derived from the
   * model rather than invented: how much of the road network is open, how
   * many key places are still reachable, how much land is dry.
   */
  const score = useMemo(() => {
    if (!ready) return 0;
    const roadsOpen =
      1 - status.blockedCount / Math.max(1, status.totalSegments);
    const placesOpen = 1 - status.cutOff.length / 5;
    const landDry = 1 - status.floodedFraction;
    return Math.round((roadsOpen * 0.4 + placesOpen * 0.35 + landDry * 0.25) * 100);
  }, [ready, status]);

  const sev = SEVERITY_LABEL[status.severity];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ---- Left column: conditions ---- */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                Operations overview
              </div>
              <h1 className="font-serif text-[26px] font-semibold text-navy">
                {formatClock(step)}
              </h1>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {horizon > 0
                  ? `Panels below show the forecast ${horizon} h ahead.`
                  : "Panels below show live conditions."}
              </p>
            </div>
            <Pill tone={sev.tone}>{sev.text}</Pill>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat
              label="Water level"
              value={`${status.waterLevelM.toFixed(2)} m`}
              detail={`tide ${status.tideM.toFixed(2)} + surge ${status.surgeM.toFixed(2)}`}
              tone={status.waterLevelM > 2.5 ? "danger" : undefined}
            />
            <Stat
              label="Rainfall"
              value={`${status.rainfallMmHr.toFixed(1)} mm/h`}
              detail={`${(status.rainAccumM * 100).toFixed(0)} cm accumulated`}
              tone={status.rainfallMmHr > 20 ? "warn" : undefined}
            />
            <Stat
              label="Roads impassable"
              value={`${status.blockedCount} / ${status.totalSegments}`}
              detail={`${Math.round((status.blockedCount / status.totalSegments) * 100)}% of network`}
              tone={
                status.blockedCount / status.totalSegments > 0.25
                  ? "danger"
                  : status.blockedCount / status.totalSegments > 0.1
                    ? "warn"
                    : "ok"
              }
            />
            <Stat
              label="Places cut off"
              value={String(status.cutOff.length)}
              detail={
                status.cutOff.length
                  ? status.cutOff.map(shortName).join(", ")
                  : "all reachable"
              }
              tone={status.cutOff.length ? "danger" : "ok"}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/map"
                className="text-[12px] font-semibold text-teal-dark hover:underline"
              >
                Open forecast map
              </Link>
            }
          >
            Flood outlook
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {outlook.map(({ h, st }) => (
              <div
                key={h}
                className={`rounded-[14px] p-3 text-center ${
                  st.waterLevelM > 2.5 ? "bg-coral-tint" : "bg-sand"
                }`}
              >
                <div className="font-serif text-[19px] font-semibold text-navy">
                  {st.waterLevelM.toFixed(1)} m
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-soft">
                  {h === 0 ? "now" : `+${h}h`}
                </div>
                <div className="mt-1 text-[10.5px] text-ink-soft">
                  {st.blockedCount} roads cut
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft">
            {worst.st.cutOff.length ? (
              <>
                By <strong className="text-navy">+{worst.h} h</strong> the model
                expects{" "}
                <strong className="text-coral-dark">
                  {worst.st.cutOff.length} key location
                  {worst.st.cutOff.length === 1 ? "" : "s"}
                </strong>{" "}
                to be cut off — {worst.st.cutOff.map(shortName).join(", ")}.
              </>
            ) : (
              "No key locations are expected to be cut off within 24 hours."
            )}
          </p>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/map"
                className="text-[12px] font-semibold text-teal-dark hover:underline"
              >
                View on map
              </Link>
            }
          >
            Active incidents
          </SectionTitle>
          <ul>
            {incidentRows.map(({ item, reachable, distanceM }) => {
              const depth = floodDepthAt(item.lng, item.lat, step, horizon);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 border-b border-sand-dim py-2.5 last:border-b-0"
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                    style={{
                      background:
                        depth > 0
                          ? "var(--color-coral-tint)"
                          : "var(--color-sand-dim)",
                    }}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-navy">
                      {item.title}
                    </span>
                    <span className="block text-[11.5px] text-ink-soft">
                      {depth > 0
                        ? `Under ${depth.toFixed(2)} m of water`
                        : "Dry at this hour"}{" "}
                      · {item.confirmations} confirmations
                    </span>
                  </span>
                  {reachable ? (
                    <span className="text-[12px] font-bold text-navy">
                      {distanceM! >= 1000
                        ? `${(distanceM! / 1000).toFixed(1)} km`
                        : `${Math.round(distanceM!)} m`}
                    </span>
                  ) : (
                    <Pill tone="coral">Cut off</Pill>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            href="/report"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-coral px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(226,87,43,0.3)] transition-opacity hover:opacity-90"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[15px]"
              aria-hidden="true"
            >
              ＋
            </span>
            Report a hazard
          </Link>
        </Card>
      </div>

      {/* ---- Right column: where to send people ---- */}
      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Town safety score</SectionTitle>
          <div className="flex items-center gap-4">
            <div
              className="flex h-[74px] w-[74px] flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${
                  score > 66
                    ? "var(--color-teal)"
                    : score > 33
                      ? "var(--color-amber)"
                      : "var(--color-coral)"
                } 0% ${score}%, var(--color-sand-dim) ${score}% 100%)`,
              }}
              role="img"
              aria-label={`Town safety score ${score} out of 100`}
            >
              <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-card">
                <b className="font-serif text-[20px] leading-none text-navy">
                  {score}
                </b>
                <span className="text-[8.5px] font-bold text-ink-soft">
                  / 100
                </span>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Derived from the model: share of the road network still open,
              key places still reachable, and land still dry. Not a rating —
              it moves as you scrub the timeline.
            </p>
          </div>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/map"
                className="text-[12px] font-semibold text-teal-dark hover:underline"
              >
                Route it
              </Link>
            }
          >
            Send people here
          </SectionTitle>
          {s.recommendedShelter ? (
            <>
              <div className="mb-1 font-serif text-[17px] font-semibold text-navy">
                {s.recommendedShelter.item.name}
              </div>
              <div className="text-[12px] text-ink-soft">
                {s.recommendedShelter.item.type} ·{" "}
                {s.recommendedShelter.item.elevationM} m above sea level
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill tone="teal">
                  {(s.recommendedShelter.distanceM! / 1000).toFixed(2)} km by
                  road
                </Pill>
                <Pill tone="blue">
                  {s.recommendedShelter.item.capacityTotal -
                    s.recommendedShelter.item.capacityUsed}{" "}
                  spaces
                </Pill>
                {s.recommendedShelter.item.accessible && (
                  <Pill tone="teal">Accessible</Pill>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-[14px] bg-coral-tint p-3 text-[12px] font-semibold leading-relaxed text-coral-dark">
              No evacuation centre is reachable by road from{" "}
              {s.originId.replace("-", " ")} at this moment. Shelter in place
              and request water rescue.
            </div>
          )}
          <p className="mt-3 border-t border-sand-dim pt-2.5 text-[11px] leading-relaxed text-ink-soft">
            Chosen by the router, not by straight-line distance — a centre
            300 m away across a flooded causeway is no distance at all.
          </p>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/resources"
                className="text-[12px] font-semibold text-teal-dark hover:underline"
              >
                See all
              </Link>
            }
          >
            Resources nearby
          </SectionTitle>
          <ul>
            {resourceRows.map(({ item, reachable, distanceM }) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 border-b border-sand-dim py-2 last:border-b-0"
              >
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-teal-tint text-[14px]"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-navy">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    {item.owner}
                    {item.verified ? " ✔" : ""}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[11.5px] font-bold text-navy">
                  {reachable
                    ? distanceM! >= 1000
                      ? `${(distanceM! / 1000).toFixed(1)} km`
                      : `${Math.round(distanceM!)} m`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/volunteer"
                className="text-[12px] font-semibold text-teal-dark hover:underline"
              >
                Dispatch
              </Link>
            }
          >
            Open volunteer jobs
          </SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            <strong className="font-serif text-[18px] text-navy">
              {s.jobs.filter((j) => j.joined + (s.joined.has(j.id) ? 1 : 0) < j.needed).length}
            </strong>{" "}
            of {s.jobs.length} jobs still need volunteers,{" "}
            {s.jobs.filter((j) => j.urgent).length} marked urgent.
          </p>
        </Card>
      </div>
    </div>
  );
}
