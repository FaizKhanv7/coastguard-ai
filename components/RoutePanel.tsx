import React, { useState } from 'react';
import { Button, Badge } from './ui';

interface Landmark {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
}

interface RoutePanelProps {
  landmarks: Landmark[];
  selectedOrigin: string | null;
  selectedDestination: string | null;
  onSelectOrigin: (id: string) => void;
  onSelectDestination: (id: string) => void;
  onComputeRoute: () => void;
  isCalculating: boolean;
  routeResult?: {
    distanceKm: number;
    estimatedTimeMin: number;
    passability: 'SAFE' | 'CAUTION' | 'BLOCKED';
    maxWaterDepthM: number;
    steps: string[];
  } | null;
}

export default function RoutePanel({
  landmarks = [],
  selectedOrigin,
  selectedDestination,
  onSelectOrigin,
  onSelectDestination,
  onComputeRoute,
  isCalculating,
  routeResult,
}: RoutePanelProps) {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'shelters'>('dispatch');

  return (
    <div className="hud-panel p-4 rounded-xl border border-cyan-500/20 flex flex-col gap-4">
      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'dispatch'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-route mr-1.5" />
            EVACUATION ROUTING
          </button>
          <button
            onClick={() => setActiveTab('shelters')}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'shelters'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-shield-halved mr-1.5" />
            SAFE HAVENS ({landmarks.length})
          </button>
        </div>
        <span className="text-[10px] font-mono text-cyan-400/80 tracking-wider">A* TACTICAL SOLVER</span>
      </div>

      {activeTab === 'dispatch' ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Origin selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-rose-400" />
                INCIDENT ORIGIN (AT RISK)
              </label>
              <select
                value={selectedOrigin || ''}
                onChange={(e) => onSelectOrigin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="">Select origin point...</option>
                {landmarks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-flag-checkered text-emerald-400" />
                DESTINATION / SHELTER
              </label>
              <select
                value={selectedDestination || ''}
                onChange={(e) => onSelectDestination(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="">Select safe haven...</option>
                {landmarks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={onComputeRoute}
            disabled={!selectedOrigin || !selectedDestination || isCalculating}
            variant="primary"
            className="w-full mt-1"
            icon={isCalculating ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-calculator'}
          >
            {isCalculating ? 'COMPUTING HYDROLOGICAL PASSABILITY...' : 'SOLVE OPTIMAL PASSABLE CORRIDOR'}
          </Button>

          {/* Route results pane */}
          {routeResult && (
            <div className="mt-2 p-3.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CORRIDOR EVALUATION:</span>
                <Badge
                  variant={
                    routeResult.passability === 'SAFE'
                      ? 'success'
                      : routeResult.passability === 'CAUTION'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {routeResult.passability} PASSABILITY
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">DISTANCE</div>
                  <div className="text-sm font-bold text-white mt-0.5">{routeResult.distanceKm} km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">ETA CORRIDOR</div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">{routeResult.estimatedTimeMin} min</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">MAX WATER HEAD</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">{routeResult.maxWaterDepthM} m</div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Navigation Waypoints:</span>
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {routeResult.steps.map((step, idx) => (
                    <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Safe Havens List */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {landmarks.map((l) => (
            <div
              key={l.id}
              className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between hover:border-cyan-500/40 transition-all"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200">{l.name}</div>
                <div className="text-[10px] font-mono text-cyan-400/80">{l.type}</div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {l.lat.toFixed(3)}, {l.lng.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
