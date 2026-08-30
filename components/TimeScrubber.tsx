"use client";

/**
 * The 48-hour timeline along the bottom of the map.
 *
 * The control itself is a plain <input type="range">, which gets keyboard
 * support, screen-reader announcement and touch handling for free. The water
 * level sparkline and storm marker are painted behind it as decoration and
 * hidden from assistive tech — `aria-valuetext` carries the same information
 * in words.
 */

import { useMemo } from "react";
import { STEP_COUNT, STEP_HOURS } from "@/lib/flood";
import { formatClock, levelSeries, stormPeakHour } from "@/lib/useCoastguard";

interface Props {
  step: number;
  onStep: (s: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  waterLevelM: number;
  /** Forecast horizon in hours; 0 means the map is showing this moment. */
  horizon: number;
  /** Water level at the moment the map is actually showing. */
  displayedLevelM: number;
}

export default function TimeScrubber({
  step,
  onStep,
  playing,
  onTogglePlay,
  waterLevelM,
  horizon,
  displayedLevelM,
}: Props) {
  // Sparkline of the whole 48 h water level series, as an SVG path.
  const { path, peakX } = useMemo(() => {
    const min = Math.min(...levelSeries);
    const max = Math.max(...levelSeries);
    const span = max - min || 1;
    const pts = levelSeries.map((v, i) => {
      const x = (i / (STEP_COUNT - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      path: `M0,100 L${pts.join(" L")} L100,100 Z`,
      peakX: (stormPeakHour / (STEP_HOURS * (STEP_COUNT - 1))) * 100,
    };
  }, []);

  const hours = step * STEP_HOURS;
  const progressPct = (step / (STEP_COUNT - 1)) * 100;

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? "Pause the flood animation" : "Play the flood animation"}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-navy text-white shadow-[0_6px_16px_rgba(14,42,51,0.35)] transition-transform hover:scale-105"
          >
            {playing ? (
              <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
                <rect x="0" y="0" width="4.5" height="16" rx="1.4" fill="currentColor" />
                <rect x="9.5" y="0" width="4.5" height="16" rx="1.4" fill="currentColor" />
              </svg>
            ) : (
              <svg width="15" height="16" viewBox="0 0 15 16" aria-hidden="true">
                <path d="M1 1.2 L14 8 L1 14.8 Z" fill="currentColor" strokeLinejoin="round" strokeWidth="2" stroke="currentColor" />
              </svg>
            )}
          </button>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">
              Timeline position
            </div>
            <div className="font-serif text-lg font-semibold text-navy">
              {formatClock(step)}
            </div>
            {horizon > 0 && (
              <div className="text-[10.5px] font-semibold text-amber-dark">
                map showing +{horizon} h &rarr; {formatClock(step + horizon / STEP_HOURS)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">
              Water level here
            </div>
            <div className="font-serif text-lg font-semibold text-navy">
              {waterLevelM.toFixed(2)} m
            </div>
            {horizon > 0 && (
              <div className="text-[10.5px] font-semibold text-amber-dark">
                {displayedLevelM.toFixed(2)} m on the map
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">
              Elapsed
            </div>
            <div className="font-serif text-lg font-semibold text-navy">
              +{hours.toFixed(1)} h
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Decorative water-level profile behind the track. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-0 h-9 w-full"
          aria-hidden="true"
        >
          <path d={path} fill="var(--color-blue-tint)" />
          <line
            x1={peakX}
            y1="0"
            x2={peakX}
            y2="100"
            stroke="var(--color-coral)"
            strokeWidth="0.6"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x="0"
            y="0"
            width={progressPct}
            height="100"
            fill="var(--color-navy)"
            opacity="0.08"
          />
        </svg>

        <input
          type="range"
          min={0}
          max={STEP_COUNT - 1}
          step={1}
          value={step}
          onChange={(e) => onStep(Number(e.target.value))}
          aria-label="Forecast time, 48 hour window"
          aria-valuetext={`${formatClock(step)}, ${hours.toFixed(1)} hours elapsed, water level ${waterLevelM.toFixed(2)} metres`}
          className="relative z-10 h-9 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-sand-dim
            [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-navy [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-sand-dim
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-navy"
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-soft">
        <span>Day 1 · 00:00</span>
        <span className="text-coral-dark">▲ storm peak · h{stormPeakHour}</span>
        <span>Day 3 · 00:00</span>
      </div>
    </div>
  );
}
