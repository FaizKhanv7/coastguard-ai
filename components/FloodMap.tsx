'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useFloodStore } from '@/lib/store';
import { Layers, Shield, Navigation, AlertCircle, Plus, Eye, EyeOff } from 'lucide-react';

export function FloodMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { 
    dem, 
    floodDepthGrid, 
    currentStep, 
    barriers, 
    toggleBarrier, 
    selectedRoute,
    activeLayer,
    setActiveLayer 
  } = useFloodStore();

  const [hoverInfo, setHoverInfo] = useState<{ lon: number; lat: number; depth: number } | null>(null);
  const [showBarriers, setShowBarriers] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = dem.width || 128;
    const height = dem.height || 128;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let i = 0; i < width * height; i++) {
      const pixelIdx = i * 4;
      const elev = dem.elevation[i];
      const depth = floodDepthGrid ? floodDepthGrid[i] : 0;

      if (activeLayer === 'elevation') {
        const normElev = Math.min(255, Math.max(0, elev * 12));
        data[pixelIdx] = 30 + normElev * 0.4;
        data[pixelIdx + 1] = 60 + normElev * 0.7;
        data[pixelIdx + 2] = 40 + normElev * 0.2;
        data[pixelIdx + 3] = 255;
      } else {
        // Base terrain dark map
        data[pixelIdx] = 15;
        data[pixelIdx + 1] = 23;
        data[pixelIdx + 2] = 42;
        data[pixelIdx + 3] = 255;

        // Flood Overlay
        if (depth > 0.05) {
          const depthAlpha = Math.min(220, Math.max(80, depth * 90));
          data[pixelIdx] = 30;
          data[pixelIdx + 1] = 120 + Math.min(100, depth * 40);
          data[pixelIdx + 2] = 245;
          data[pixelIdx + 3] = depthAlpha;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Render Route overlay if present
    if (selectedRoute && selectedRoute.coordinates.length > 1) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      selectedRoute.coordinates.forEach(([lon, lat], idx) => {
        if (!dem.bounds) return;
        const [minX, minY, maxX, maxY] = dem.bounds;
        const x = ((lon - minX) / (maxX - minX)) * width;
        const y = (1 - (lat - minY) / (maxY - minY)) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [dem, floodDepthGrid, activeLayer, selectedRoute]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dem || !dem.bounds || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * dem.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * dem.height);

    if (x >= 0 && x < dem.width && y >= 0 && y < dem.height) {
      const idx = y * dem.width + x;
      const depth = floodDepthGrid ? floodDepthGrid[idx] : 0;
      const [minX, minY, maxX, maxY] = dem.bounds;
      const lon = minX + (x / dem.width) * (maxX - minX);
      const lat = maxY - (y / dem.height) * (maxY - minY);
      setHoverInfo({ lon, lat, depth });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Map Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg">
        <button
          onClick={() => setActiveLayer('flood')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeLayer === 'flood'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Flood Inundation
        </button>
        <button
          onClick={() => setActiveLayer('elevation')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeLayer === 'elevation'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          DEM Topography
        </button>
      </div>

      {/* Barrier Quick Toggle Drawer */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 max-w-xs">
        <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              Hydro Defense Gates
            </span>
            <button 
              onClick={() => setShowBarriers(!showBarriers)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              {showBarriers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showBarriers && (
            <div className="space-y-1.5 pt-1">
              {barriers.map(b => (
                <div key={b.id} className="flex items-center justify-between text-[11px] bg-slate-800/60 px-2 py-1 rounded-lg">
                  <span className="text-slate-300 truncate max-w-[130px]">{b.name}</span>
                  <button
                    onClick={() => toggleBarrier(b.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      b.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {b.active ? 'DEPLOYED' : 'OPEN'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Render Canvas */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full h-full max-h-[680px] object-contain rounded-xl cursor-crosshair border border-slate-800/60"
        />

        {/* Dynamic Coordinate / Inundation HUD */}
        {hoverInfo && (
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 text-xs text-slate-200 shadow-xl pointer-events-none space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono">
              {hoverInfo.lat.toFixed(4)}°N, {Math.abs(hoverInfo.lon).toFixed(4)}°W
            </div>
            <div className="font-semibold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${hoverInfo.depth > 0.3 ? 'bg-rose-500 animate-ping' : hoverInfo.depth > 0 ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
              Flood Inundation Depth: <span className="text-cyan-300">{hoverInfo.depth.toFixed(2)} m</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
