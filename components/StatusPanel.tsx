import React from 'react';
import { Badge, MetricCard } from './ui';

interface StatusPanelProps {
  floodedRoadsCount: number;
  totalRoadsCount: number;
  inundatedAreaSqKm: number;
  criticalAtRiskCount: number;
  evacuationRoutesActive: number;
  peakDepthM: number;
}

export default function StatusPanel({
  floodedRoadsCount = 14,
  totalRoadsCount = 82,
  inundatedAreaSqKm = 3.42,
  criticalAtRiskCount = 3,
  evacuationRoutesActive = 4,
  peakDepthM = 1.64,
}: StatusPanelProps) {
  const roadRiskRatio = Math.round((floodedRoadsCount / Math.max(totalRoadsCount, 1)) * 100);

  return (
    <div className="space-y-4">
      {/* Realtime Threat Banner */}
      <div className="hud-panel p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-lg animate-pulse">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tracking-widest text-rose-400 font-bold uppercase">Condition: Coastal Flood Alert</span>
              <Badge variant="danger">SEVERITY 3</Badge>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">Cat-2 Surge event in progress. Surge peak matching astronomic spring tide.</p>
          </div>
        </div>
        <Badge variant="cyan" className="hidden md:inline-flex">GRID ONLINE</Badge>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Inundated Grid Area"
          value={inundatedAreaSqKm.toFixed(2)}
          unit="km²"
          trend="+18% in last hour"
          color="cyan"
          icon="fa-solid fa-water"
        />
        <MetricCard
          label="Roadway Blockages"
          value={`${floodedRoadsCount}/${totalRoadsCount}`}
          unit={`(${roadRiskRatio}%)`}
          trend="Critical arteries affected"
          color="rose"
          icon="fa-solid fa-road-barrier"
        />
        <MetricCard
          label="Peak Water Column"
          value={peakDepthM.toFixed(2)}
          unit="meters"
          trend="Over mean sea level"
          color="amber"
          icon="fa-solid fa-arrows-up-down"
        />
        <MetricCard
          label="Critical Landmarks"
          value={criticalAtRiskCount}
          unit="Facilities At Risk"
          trend="Hospital / Substation alerted"
          color="emerald"
          icon="fa-solid fa-hospital"
        />
      </div>
    </div>
  );
}
