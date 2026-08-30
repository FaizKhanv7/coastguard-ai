"use client";

/**
 * The community layer, on the operations side.
 *
 * These are the same shelters, incidents, resources and volunteer jobs the
 * field app shows — one shared dataset — but run through the flood model and
 * the router. So instead of a static list, every row here answers the
 * question an operator actually has: can we still get to it, how far is it by
 * road right now, and is it under water at the moment we are looking at.
 */

import { useMemo } from "react";
import {
  community,
  reachability,
  floodDepthAt,
  type RiskTolerance,
} from "@/lib/engine";
import { Card, Pill, SectionTitle, type Tone } from "./ui";

interface Props {
  originNodeId: string;
  step: number;
  horizonH: number;
  mode: RiskTolerance;
}

const km = (m: number | null) =>
  m === null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

const SEVERITY_TONE: Record<string, Tone> = {
  High: "coral",
  Medium: "amber",
  Low: "teal",
};

/** Shared row chrome so the four lists read as one family. */
function Row({
  icon,
  iconBg,
  title,
  subtitle,
  right,
  cutOff,
}: {
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  cutOff?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 border-b border-sand-dim py-2.5 last:border-b-0 ${
        cutOff ? "opacity-70" : ""
      }`}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px]"
        style={{ background: iconBg }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-navy">
          {title}
        </span>
        <span className="block truncate text-[11px] text-ink-soft">
          {subtitle}
        </span>
      </span>
      {right && <span className="flex-shrink-0">{right}</span>}
    </li>
  );
}

/** "1.2 km" when reachable, an explicit cut-off badge when not. */
function Reach({
  reachable,
  distanceM,
  etaMinutes,
}: {
  reachable: boolean;
  distanceM: number | null;
  etaMinutes: number | null;
}) {
  if (!reachable) return <Pill tone="coral">Cut off</Pill>;
  return (
    <span className="block text-right">
      <span className="block text-[12.5px] font-bold text-navy">
        {km(distanceM)}
      </span>
      <span className="block text-[10px] text-ink-soft">
        {etaMinutes === null ? "" : `${Math.round(etaMinutes)} min`}
      </span>
    </span>
  );
}

export default function CommunityPanel({
  originNodeId,
  step,
  horizonH,
  mode,
}: Props) {
  const opts = useMemo(
    () => ({ step, horizonH, mode }),
    [step, horizonH, mode],
  );

  const shelters = useMemo(
    () => reachability(community.shelters, originNodeId, opts),
    [originNodeId, opts],
  );
  const incidents = useMemo(
    () => reachability(community.incidents, originNodeId, opts),
    [originNodeId, opts],
  );
  const resources = useMemo(
    () => reachability(community.resources, originNodeId, opts),
    [originNodeId, opts],
  );
  const jobs = useMemo(
    () => reachability(community.volunteerJobs, originNodeId, opts),
    [originNodeId, opts],
  );

  const sheltersCutOff = shelters.filter((r) => !r.reachable).length;

  const openSpots = community.shelters.reduce(
    (n, s) => n + Math.max(0, s.capacityTotal - s.capacityUsed),
    0,
  );

  return (
    <>
      <Card>
        <SectionTitle
          action={
            sheltersCutOff ? (
              <Pill tone="coral">
                {sheltersCutOff} of {shelters.length} cut off
              </Pill>
            ) : (
              <Pill tone="teal">All reachable</Pill>
            )
          }
        >
          Evacuation centres
        </SectionTitle>
        <p className="mb-1 text-[11px] leading-relaxed text-ink-soft">
          {openSpots} spaces open across {community.shelters.length} centres.
          Distances are by road through the still-passable network, not straight
          line.
        </p>
        <ul>
          {shelters
            .slice()
            .sort(
              (a, b) =>
                Number(b.reachable) - Number(a.reachable) ||
                (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
            )
            .map(({ item, reachable, distanceM, etaMinutes }) => {
              const free = item.capacityTotal - item.capacityUsed;
              return (
                <Row
                  key={item.id}
                  icon="🏠"
                  iconBg="var(--color-blue-tint)"
                  title={item.name}
                  subtitle={`${item.type} · ${item.elevationM} m · ${
                    free > 0 ? `${free} spaces` : "full"
                  }${item.accessible ? " · accessible" : ""}`}
                  cutOff={!reachable}
                  right={
                    <Reach
                      reachable={reachable}
                      distanceM={distanceM}
                      etaMinutes={etaMinutes}
                    />
                  }
                />
              );
            })}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Active incidents</SectionTitle>
        <ul>
          {incidents.map(({ item, reachable, distanceM, etaMinutes }) => {
            const depth = floodDepthAt(item.lng, item.lat, step, horizonH);
            return (
              <Row
                key={item.id}
                icon={item.icon}
                iconBg={
                  depth > 0
                    ? "var(--color-coral-tint)"
                    : "var(--color-sand-dim)"
                }
                title={item.title}
                subtitle={
                  depth > 0
                    ? `Under ${depth.toFixed(2)} m of water · ${item.confirmations} confirmations`
                    : `Dry at this hour · ${item.confirmations} confirmations`
                }
                cutOff={!reachable}
                right={
                  <span className="flex flex-col items-end gap-1">
                    <Pill tone={SEVERITY_TONE[item.severity] ?? "neutral"}>
                      {item.severity}
                    </Pill>
                    <Reach
                      reachable={reachable}
                      distanceM={distanceM}
                      etaMinutes={etaMinutes}
                    />
                  </span>
                }
              />
            );
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Shared resources</SectionTitle>
        <ul>
          {resources.map(({ item, reachable, distanceM, etaMinutes }) => (
            <Row
              key={item.id}
              icon={item.icon}
              iconBg="var(--color-teal-tint)"
              title={item.name}
              subtitle={`${item.owner}${item.verified ? " ✔" : ""} · ${item.status}`}
              cutOff={!reachable}
              right={
                <Reach
                  reachable={reachable}
                  distanceM={distanceM}
                  etaMinutes={etaMinutes}
                />
              }
            />
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Volunteer dispatch</SectionTitle>
        <ul>
          {jobs.map(({ item, reachable, distanceM, etaMinutes }) => (
            <Row
              key={item.id}
              icon={item.accessibility ? "♿" : item.urgent ? "⚠️" : "🤝"}
              iconBg={
                item.urgent
                  ? "var(--color-amber-tint)"
                  : "var(--color-sand-dim)"
              }
              title={item.title}
              subtitle={`${item.joined}/${item.needed} joined · ~${item.durationHours} hr · verified by ${item.verifiedBy}`}
              cutOff={!reachable}
              right={
                <Reach
                  reachable={reachable}
                  distanceM={distanceM}
                  etaMinutes={etaMinutes}
                />
              }
            />
          ))}
        </ul>
      </Card>
    </>
  );
}
