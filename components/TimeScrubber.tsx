import React, { useEffect } from 'react';
import { Button } from './ui';

interface TimeScrubberProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  forcingData?: {
    time: string[];
    tide_level_m: number[];
    surge_m: number[];
    rain_rate_mmh: number[];
  };
}

export default function TimeScrubber({
  currentStep,
  totalSteps,
  onStepChange,
  isPlaying,
  onTogglePlay,
  forcingData,
}: TimeScrubberProps) {
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        onStepChange((currentStep + 1) % totalSteps);
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, totalSteps, onStepChange]);

  const currentTimeStr = forcingData?.time?.[currentStep] || `T+${currentStep * 10}m`;
  const tideNow = forcingData?.tide_level_m?.[currentStep]?.toFixed(2) ?? '0.00';
  const surgeNow = forcingData?.surge_m?.[currentStep]?.toFixed(2) ?? '0.00';
  const rainNow = forcingData?.rain_rate_mmh?.[currentStep]?.toFixed(1) ?? '0.0';

  return (
    <div className="hud-panel p-4 rounded-xl border border-cyan-500/20 flex flex-col gap-3">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={onTogglePlay}
            variant={isPlaying ? 'danger' : 'primary'}
            size="sm"
            icon={isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'}
          >
            {isPlaying ? 'PAUSE FEED' : 'SIMULATE REALTIME'}
          </Button>

          <Button
            onClick={() => onStepChange(0)}
            variant="secondary"
            size="sm"
            icon="fa-solid fa-rotate-left"
          >
            RESET
          </Button>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/80 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-slate-400">TIMESTAMP:</span>
            <span className="text-cyan-300 font-bold">{currentTimeStr}</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-3 text-slate-300">
            <span>Tide: <strong className="text-sky-400">{tideNow}m</strong></span>
            <span>Surge: <strong className="text-rose-400">+{surgeNow}m</strong></span>
            <span>Precip: <strong className="text-teal-400">{rainNow} mm/h</strong></span>
          </div>
        </div>
      </div>

      {/* Interactive Range Scrubber */}
      <div className="relative flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStep}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
          <span>T+0h (Onset)</span>
          <span>T+2h (Peak Surge)</span>
          <span>T+4h (High Tide)</span>
          <span>T+6h (Receding)</span>
        </div>
      </div>
    </div>
  );
}
