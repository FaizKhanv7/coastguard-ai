'use client';

import React from 'react';
import Link from 'next/link';
import { useFloodStore } from '@/lib/store';
import { 
  AlertTriangle, 
  MapPin, 
  ShieldCheck, 
  Navigation, 
  Activity, 
  Users, 
  Compass, 
  ArrowRight,
  TrendingUp,
  Layers
} from 'lucide-react';

export function Dashboard() {
  const { 
    currentStep, 
    forcing, 
    activeRoadCount, 
    floodedRoadCount, 
    evacuationCount,
    reports 
  } = useFloodStore();

  const currentForcing = forcing?.steps?.[currentStep] || {
    surge: 0,
    rainfall: 0,
    wind: 0,
    tide: 0
  };

  const totalRoads = activeRoadCount + floodedRoadCount;
  const floodedPercent = totalRoads > 0 ? Math.round((floodedRoadCount / totalRoads) * 100) : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero / Alert Banner */}
      <div className="bg-gradient-to-r from-blue-900/80 via-slate-900 to-indigo-950/80 border border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/30">
              <Activity className="w-3.5 h-3.5 animate-pulse text-blue-400" />
              Live Simulation Active: T+{currentStep}h
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Operational CoastGuard Command
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Real-time hydro-barrier simulation, dynamic routing engine, and emergency response orchestration.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50"
            >
              Open Tactical Map
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Storm Surge</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{currentForcing.surge.toFixed(2)}</span>
            <span className="text-xs text-slate-400">m</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tidal level: {currentForcing.tide.toFixed(2)}m</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Flooded Roads</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-400">{floodedRoadCount}</span>
            <span className="text-xs text-slate-400">/ {totalRoads} ({floodedPercent}%)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{activeRoadCount} segments safe</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Evacuation Capacity</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-400">{evacuationCount || 4}</span>
            <span className="text-xs text-slate-400">Shelters Open</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">High-ground points active</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Citizen Reports</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-indigo-400">{reports?.length || 0}</span>
            <span className="text-xs text-slate-400">Verified</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Crowdsourced ground intel</p>
        </div>
      </div>

      {/* Action Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link 
          href="/map"
          className="group p-5 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-blue-500/50 rounded-2xl transition-all duration-200 shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4 group-hover:text-blue-400 transition-colors">
            Interactive Flood Simulation
          </h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            Inspect terrain elevation models, 2D raster flood progression, barrier toggles, and safe path routes.
          </p>
        </Link>

        <Link 
          href="/assistant"
          className="group p-5 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all duration-200 shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4 group-hover:text-indigo-400 transition-colors">
            AI Dispatch Assistant
          </h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            Ask natural language questions about local road impassability, shelter proximity, and water level crest times.
          </p>
        </Link>

        <Link 
          href="/report"
          className="group p-5 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition-all duration-200 shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4 group-hover:text-cyan-400 transition-colors">
            Incident Incident Reporting
          </h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            Report blocked culverts, localized standing water, or stranded individuals into the central situational feed.
          </p>
        </Link>
      </div>
    </div>
  );
}
