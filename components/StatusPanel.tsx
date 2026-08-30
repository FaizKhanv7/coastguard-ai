"use client";

/**
 * Conditions readout for whatever timestep the map is showing.
 *
 * The whole panel is an aria-live region so a screen-reader user hears the
 * situation change as the timeline plays, rather than having to go looking.
 */

import { Card, Pill, SectionTitle, Stat } from "./ui";
import type { FloodState } from "@/lib/flood";
import { shortName, type Landmark } from "@/lib/routing";
import { totalSegments } from "@/lib/useCoastguard";

interface Props {
  displayed: FloodState;
  horizon: number;
  blockedCount: number;
  cutOff: Landmark[];
  floodedFraction: number;
}

export default function StatusPanel({
  displayed,
  horizon,
  blockedCount,
  cutOff,
  floodedFraction,
}: Props) {
  const severity =
    displayed.waterLevelM > 2.5
      ? { tone: "coral" as const, label: "Severe flooding" }
      : displayed.waterLevelM > 1.5
        ? { tone: "amber" as const, label: "Flooding" }
        : displayed.waterLevelM > 0.6
          ? { tone: "blue" as const, label: "Elevated tide" }
          : { tone: "teal" as const, label: "Normal conditions" };

  const blockedPct = Math.round((blockedCount / totalSegments) * 100);

  return (
    <Card>
      <SectionTitle
        action={<Pill tone={severity.tone}>{severity.label}</Pill>}
      >
        {horizon === 0 ? "Conditions now" : `Projected +${horizon} h`}
      </SectionTitle>

      <div
        className="grid grid-cols-2 gap-2.5"
        aria-live="polite"
        aria-atomic="true"
      >
        <Stat
          label="Water level"
          value={`${displayed.waterLevelM.toFixed(2)} m`}
          detail={`tide ${displayed.tideM.toFixed(2)} + surge ${displayed.surgeM.toFixed(2)}`}
          tone={displayed.waterLevelM > 2.5 ? "danger" : undefined}
        />
        <Stat
          label="Rainfall"
          value={`${displayed.rainfallMmHr.toFixed(1)} mm/h`}
          detail={`${(displayed.rainAccumM * 100).toFixed(0)} cm accumulated`}
          tone={displayed.rainfallMmHr > 20 ? "warn" : undefined}
        />
        <Stat
          label="Roads impassable"
          value={`${blockedCount} / ${totalSegments}`}
          detail={`${blockedPct}% of the network`}
          tone={blockedPct > 25 ? "danger" : blockedPct > 10 ? "warn" : "ok"}
        />
        <Stat
          label="Landmarks cut off"
          value={String(cutOff.length)}
          detail={
            cutOff.length
              ? cutOff.map(shortName).join(", ")
              : "all reachable"
          }
          tone={cutOff.length ? "danger" : "ok"}
        />
      </div>

      <div className="mt-3 space-y-2 border-t border-sand-dim pt-3 text-[11.5px] leading-relaxed text-ink-soft">
        <p>
          <strong className="text-navy">
            {(floodedFraction * 100).toFixed(1)}%
          </strong>{" "}
          of the town&rsquo;s land area is under water, and wind is gusting to{" "}
          <strong className="text-navy">
            {displayed.windKph.toFixed(0)} km/h
          </strong>
          .
        </p>
        {displayed.isolatedCells > 0 && (
          <p>
            <strong className="text-navy">{displayed.isolatedCells}</strong>{" "}
            cells sit below the water level but have no path to the sea, so the
            model correctly leaves them dry. A plain elevation threshold would
            have flooded them.
          </p>
        )}
      </div>
    </Card>
  );
}
