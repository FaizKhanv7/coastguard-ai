import React from 'react';

export default function LegendBar() {
  const depthIntervals = [
    { label: '< 0.05m Dry', color: 'rgba(56, 189, 248, 0.05)' },
    { label: '0.15m Shallow', color: 'rgba(56, 189, 248, 0.5)' },
    { label: '0.35m Passable', color: 'rgba(14, 165, 233, 0.75)' },
    { label: '0.70m High Risk', color: 'rgba(2, 132, 199, 0.9)' },
    { label: '1.20m+ Submerged', color: 'rgba(3, 105, 161, 1)' },
  ];

  const roadStatuses = [
    { label: 'Clear Route', color: '#10b981' },
    { label: 'Caution (<0.3m)', color: '#f59e0b' },
    { label: 'Impassable (>0.3m)', color: '#f43f5e' },
    { label: 'Critical Facility', color: '#a855f7' },
  ];

  return (
    <div className="hud-panel p-3.5 rounded-xl border border-slate-800 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 font-mono">
        {/* Inundation Scale */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Water Depth:</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-32 rounded bg-gradient-to-r from-cyan-400/20 via-sky-500 to-blue-800 border border-cyan-400/30" />
            <div className="flex text-[10px] text-slate-400 gap-2">
              <span>0.0m</span>
              <span>1.5m+</span>
            </div>
          </div>
        </div>

        {/* Tactical Markers */}
        <div className="flex flex-wrap items-center gap-3">
          {roadStatuses.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span 
                className="inline-block w-2.5 h-2.5 rounded-full ring-2 ring-slate-900" 
                style={{ backgroundColor: item.color }} 
              />
              <span className="text-[11px] text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
