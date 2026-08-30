"use client";

import React from "react";
import { Badge, Button } from "./ui";

interface TimeScrubberProps {
  currentHour: number;
  maxHours: number;
  isPlaying: boolean;
  onHourChange: (hour: number) => void;
  onTogglePlay: () => void;
  forecastDate?: string;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  currentHour,
  maxHours,
  isPlaying,
  onHourChange,
  onTogglePlay,
  forecastDate = "T+0H FORECAST CYCLE",
}) => {
  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="animate-pulse" variant="cyan">
            LIVE SIMULATION
          </Badge>
          <span className="text-xs font-mono text-slate-400">{forecastDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">TIMESTEP</span>
          <span className="text-sm font-bold font-mono text-cyan-400">
            +{currentHour.toString().padStart(2, "0")}:00 HRS
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={onTogglePlay}
          variant={isPlaying ? "danger" : "primary"}
          size="sm"
          className="min-w-[72px]"
        >
          {isPlaying ? (
            <>
              <span className="w-2 h-2 bg-white rounded-sm" /> PAUSE
            </>
          ) : (
            <>
              <span className="text-xs">▶</span> PLAY
            </>
          )}
        </Button>

        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={maxHours - 1}
            value={currentHour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />
        </div>

        <div className="flex gap-1 font-mono text-xs text-slate-400">
          <span>00H</span>
          <span>/</span>
          <span>+{maxHours - 1}H</span>
        </div>
      </div>
    </div>
  );
};
