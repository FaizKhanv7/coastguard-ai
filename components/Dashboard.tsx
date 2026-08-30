"use client";

import React, { useState } from "react";
import { FloodMap } from "./FloodMap";
import { TimeScrubber } from "./TimeScrubber";
import { StatusPanel } from "./StatusPanel";
import { RoutePanel } from "./RoutePanel";
import { LegendBar } from "./LegendBar";
import { Badge } from "./ui";

export function Dashboard() {
  const [hour, setHour] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a13] text-slate-100 overflow-hidden font-sans">
      {/* Top Mission Control Header */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center font-black text-cyan-400 font-mono text-sm">
            ⬡
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm font-mono text-white">COASTGUARD AI</span>
              <span className="text-[10px] text-cyan-400 font-mono">v2.4-PRO</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Hydrodynamic Surge & Evacuation Decision Support
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="emerald">SYSTEM OPERATIONAL</Badge>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-mono text-slate-400">DEFCON 4 MONITORING</span>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left / Center Map Viewport */}
        <div className="flex-1 flex flex-col gap-3 relative">
          <div className="flex-1 relative">
            <FloodMap currentHour={hour} />
            
            {/* Overlay Map Legend */}
            <div className="absolute bottom-4 left-4 z-10">
              <LegendBar />
            </div>
          </div>

          {/* Time Scrubber Timeline */}
          <TimeScrubber
            currentHour={hour}
            isPlaying={isPlaying}
            maxHours={24}
            onHourChange={setHour}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
          />
        </div>

        {/* Right Telemetry & Action Drawer */}
        <div className="w-[380px] flex flex-col gap-4 overflow-y-auto pr-1">
          <StatusPanel
            waterLevel={1.84 + hour * 0.08}
            precipitation={32.4}
            inundationAreaKm2={14.2 + hour * 1.1}
            criticalAssetsAtRisk={hour > 5 ? 3 : 1}
          />
          <RoutePanel />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
