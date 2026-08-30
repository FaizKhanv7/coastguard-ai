"use client";

import React from "react";

export function LegendBar() {
  return (
    <div className="glass-panel px-3.5 py-2.5 rounded-lg flex items-center gap-4 text-xs font-mono text-slate-300">
      <span className="text-[11px] font-semibold tracking-wider text-slate-400">WATER DEPTH:</span>
      
      <div className="flex items-center gap-1.5">
        <div className="flex h-2.5 w-32 rounded overflow-hidden border border-slate-700/60">
          <span className="flex-1 bg-[#38bdf8]/40" />
          <span className="flex-1 bg-[#0284c7]/70" />
          <span className="flex-1 bg-[#0369a1]" />
          <span className="flex-1 bg-[#1e40af]" />
          <span className="flex-1 bg-[#4338ca]" />
        </div>
        <div className="flex justify-between w-32 text-[9px] text-slate-400">
          <span>0.1m</span>
          <span>0.5m</span>
          <span>1.5m</span>
          <span>&gt;3.0m</span>
        </div>
      </div>

      <div className="h-3 w-px bg-slate-800 mx-1" />

      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 border border-rose-400/50 inline-block" />
        <span className="text-[11px]">Submerged Roads</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 border border-emerald-300 inline-block" />
        <span className="text-[11px]">Evacuation Route</span>
      </div>
    </div>
  );
}

export default LegendBar;
