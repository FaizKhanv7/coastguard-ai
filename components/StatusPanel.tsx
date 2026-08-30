"use client";

import React from "react";
import { Badge, MetricCard } from "./ui";

interface StatusPanelProps {
  waterLevel: number;
  precipitation: number;
  inundationAreaKm2: number;
  criticalAssetsAtRisk: number;
  stormCategory?: string;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  waterLevel,
  precipitation,
  inundationAreaKm2,
  criticalAssetsAtRisk,
  stormCategory = "CATEGORY 2 SURGE",
}) => {
  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 radar-live" />
          <h3 className="font-mono text-sm font-semibold tracking-wider text-slate-100">
            METEOROLOGICAL TELEMETRY
          </h3>
        </div>
        <Badge variant={criticalAssetsAtRisk > 0 ? "rose" : "emerald"}>
          {stormCategory}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Surge Level"
          value={waterLevel.toFixed(2)}
          unit="m MSL"
          trend="+0.14m/hr tide cycle"
          color="text-cyan-400"
        />
        <MetricCard
          label="Precipitation"
          value={precipitation.toFixed(1)}
          unit="mm/h"
          trend="Severe downpour"
          color="text-sky-400"
        />
        <MetricCard
          label="Flood Extent"
          value={inundationAreaKm2.toFixed(1)}
          unit="km²"
          trend="Calculated overland"
          color="text-amber-400"
        />
        <MetricCard
          label="Impacted Nodes"
          value={criticalAssetsAtRisk}
          unit="critical"
          trend={criticalAssetsAtRisk > 0 ? "Action Required" : "Sector Clear"}
          color={criticalAssetsAtRisk > 0 ? "text-rose-400" : "text-emerald-400"}
        />
      </div>
    </div>
  );
};
