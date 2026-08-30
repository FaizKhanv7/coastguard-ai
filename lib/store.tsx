'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { DemData, ForcingData, RoadCollection, LandmarkCollection, CommunityData } from './types';
import { runFloodSimulation } from './flood';
import { findSafeRoute } from './routing';

interface Barrier {
  id: string;
  name: string;
  type: 'levee' | 'gate' | 'pump' | 'sandbag';
  location: [number, number];
  height: number;
  active: boolean;
  cost?: number;
}

interface IncidentReport {
  id: string;
  type: 'water' | 'hazard' | 'trapped' | 'shelter_full';
  location: [number, number];
  description: string;
  timestamp: string;
  verified: boolean;
}

interface FloodStoreContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  dem: DemData | null;
  forcing: ForcingData | null;
  roads: RoadCollection | null;
  landmarks: LandmarkCollection | null;
  community: CommunityData | null;
  barriers: Barrier[];
  toggleBarrier: (id: string) => void;
  addBarrier: (barrier: Barrier) => void;
  reports: IncidentReport[];
  addReport: (report: IncidentReport) => void;
  activeRoadCount: number;
  floodedRoadCount: number;
  evacuationCount: number;
  floodDepthGrid: Float32Array | null;
  selectedRoute: {
    coordinates: [number, number][];
    distance: number;
    elevationGain: number;
    safe: boolean;
  } | null;
  setRoutePoints: (start: [number, number], dest: [number, number]) => void;
  clearRoute: () => void;
  activeLayer: 'flood' | 'elevation' | 'risk' | 'satellite';
  setActiveLayer: (layer: 'flood' | 'elevation' | 'risk' | 'satellite') => void;
}

const FloodStoreContext = createContext<FloodStoreContextType | null>(null);

export function FloodStoreProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<'flood' | 'elevation' | 'risk' | 'satellite'>('flood');

  const [dem, setDem] = useState<DemData | null>(null);
  const [forcing, setForcing] = useState<ForcingData | null>(null);
  const [roads, setRoads] = useState<RoadCollection | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkCollection | null>(null);
  const [community, setCommunity] = useState<CommunityData | null>(null);

  const [barriers, setBarriers] = useState<Barrier[]>([
    { id: 'b1', name: 'Lower East Side Barrier Gate', type: 'gate', location: [-73.975, 40.718], height: 3.2, active: true },
    { id: 'b2', name: 'Red Hook Deployable Wall', type: 'levee', location: [-74.012, 40.678], height: 2.5, active: false },
    { id: 'b3', name: 'Battery Park High-Volume Pump', type: 'pump', location: [-74.015, 40.704], height: 1.8, active: true },
    { id: 'b4', name: 'Gowanus Tidal Flap Gate', type: 'gate', location: [-73.998, 40.672], height: 2.0, active: true }
  ]);

  const [reports, setReports] = useState<IncidentReport[]>([
    { id: 'r1', type: 'water', location: [-74.011, 40.705], description: 'Standing water over curb level (0.4m)', timestamp: '10m ago', verified: true },
    { id: 'r2', type: 'trapped', location: [-73.982, 40.712], description: 'Subway station entrance flooded', timestamp: '25m ago', verified: true }
  ]);

  const [activeRoadCount, setActiveRoadCount] = useState<number>(142);
  const [floodedRoadCount, setFloodedRoadCount] = useState<number>(18);
  const [evacuationCount, setEvacuationCount] = useState<number>(6);
  const [floodDepthGrid, setFloodDepthGrid] = useState<Float32Array | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<{
    coordinates: [number, number][];
    distance: number;
    elevationGain: number;
    safe: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadDatasets() {
      try {
        const [demRes, forcingRes, roadsRes, landmarksRes, commRes] = await Promise.all([
          fetch('/data/dem.json').then(r => r.json()),
          fetch('/data/forcing.json').then(r => r.json()),
          fetch('/data/roads.json').then(r => r.json()),
          fetch('/data/landmarks.json').then(r => r.json()),
          fetch('/data/community.json').then(r => r.json())
        ]);
        setDem(demRes);
        setForcing(forcingRes);
        setRoads(roadsRes);
        setLandmarks(landmarksRes);
        setCommunity(commRes);
      } catch (err) {
        console.error('Failed loading simulation datasets:', err);
      }
    }
    loadDatasets();
  }, []);

  const recalculateFlood = useCallback(() => {
    if (!dem || !forcing) return;
    const simResult = runFloodSimulation({
      dem,
      forcing,
      step: currentStep,
      barriers: barriers.filter(b => b.active)
    });
    setFloodDepthGrid(simResult.depthGrid);
    setFloodedRoadCount(simResult.floodedRoadCount);
    setActiveRoadCount(simResult.activeRoadCount);
  }, [dem, forcing, currentStep, barriers]);

  useEffect(() => {
    recalculateFlood();
  }, [recalculateFlood]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && forcing) {
      interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % (forcing.steps?.length || 24));
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isPlaying, forcing]);

  const toggleBarrier = (id: string) => {
    setBarriers(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  const addBarrier = (barrier: Barrier) => {
    setBarriers(prev => [...prev, barrier]);
  };

  const addReport = (report: IncidentReport) => {
    setReports(prev => [report, ...prev]);
  };

  const setRoutePoints = (start: [number, number], dest: [number, number]) => {
    if (!roads || !floodDepthGrid) return;
    const result = findSafeRoute({
      start,
      destination: dest,
      roads,
      waterGrid: floodDepthGrid
    });
    if (result.success) {
      setSelectedRoute({
        coordinates: result.path,
        distance: result.distance,
        elevationGain: result.elevationGain,
        safe: result.safe
      });
    }
  };

  const clearRoute = () => {
    setSelectedRoute(null);
  };

  return (
    <FloodStoreContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        isPlaying,
        setIsPlaying,
        dem,
        forcing,
        roads,
        landmarks,
        community,
        barriers,
        toggleBarrier,
        addBarrier,
        reports,
        addReport,
        activeRoadCount,
        floodedRoadCount,
        evacuationCount,
        floodDepthGrid,
        selectedRoute,
        setRoutePoints,
        clearRoute,
        activeLayer,
        setActiveLayer
      }}
    >
      {children}
    </FloodStoreContext.Provider>
  );
}

export function useFloodStore() {
  const context = useContext(FloodStoreContext);
  if (!context) {
    throw new Error('useFloodStore must be used within a FloodStoreProvider');
  }
  return context;
}
