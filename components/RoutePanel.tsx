"use client";

import React from "react";
import { Badge, Button } from "./ui";

export interface EvacuationRouteSummary {
  origin: string;
  destination: string;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  safetyScore: number;
  status: "CLEAR" | "CAUTION" | "BLOCKED";
}

interface RoutePanelProps {
  routes?: EvacuationRouteSummary[];
  onRecalculate?: () => void;
}

export function RoutePanel({
  routes = [
    {
      origin: "South Pier Station",
      destination: "Highland Emergency Shelter",
      totalDistanceKm: 6.4,
      estimatedTimeMin: 14,
      safetyScore: 94,
      status: "CLEAR",
    },
    {
      origin: "Marina Bay Sector",
      destination: "Central Medical Depot",
      totalDistanceKm: 8.1,
      estimatedTimeMin: 26,
      safetyScore: 48,
      status: "CAUTION",
    },
  ],
  onRecalculate,
}: RoutePanelProps) {
  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-mono text-sm">⤹⤸</span>
          <h3 className="font-mono text-sm font-semibold tracking-wider text-slate-100">
            EVACUATION ROUTING
          </h3>
        </div>
        <Button
          onClick={onRecalculate}
          variant="ghost"
          size="sm"
          className="text-xs font-mono"
        >
          ↻ RECOMPUTE
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {routes.map((route, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200 truncate max-w-[180px]">
                {route.origin} → {route.destination}
              </span>
              <Badge
                variant={
                  route.status === "CLEAR"
                    ? "emerald"
                    : route.status === "CAUTION"
                    ? "amber"
                    : "rose"
                }
              >
                {route.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{route.totalDistanceKm} km</span>
              <span>~{route.estimatedTimeMin} mins</span>
              <span
                className={`font-semibold ${
                  route.safetyScore > 75
                    ? "text-emerald-400"
                    : route.safetyScore > 40
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                Safety {route.safetyScore}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoutePanel;
