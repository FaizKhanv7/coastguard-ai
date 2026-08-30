"use client";

import React, { useRef, useEffect } from "react";

interface FloodMapProps {
  waterRaster?: Float32Array | null;
  gridWidth?: number;
  gridHeight?: number;
  roads?: any[];
  landmarks?: any[];
  currentHour: number;
}

export const FloodMap: React.FC<FloodMapProps> = ({
  waterRaster,
  gridWidth = 100,
  gridHeight = 100,
  roads = [],
  landmarks = [],
  currentHour,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map base background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid coordinates lines
    ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Dynamic water raster simulation layer
    const cellW = canvas.width / gridWidth;
    const cellH = canvas.height / gridHeight;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const depth = waterRaster
          ? waterRaster[y * gridWidth + x]
          : Math.max(0, Math.sin((x + currentHour * 3) / 10) * Math.cos(y / 10) * 2);

        if (depth > 0.05) {
          if (depth > 2.0) {
            ctx.fillStyle = "rgba(67, 56, 202, 0.85)";
          } else if (depth > 1.0) {
            ctx.fillStyle = "rgba(3, 105, 161, 0.75)";
          } else if (depth > 0.3) {
            ctx.fillStyle = "rgba(2, 132, 199, 0.6)";
          } else {
            ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
          }
          ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    // Road network
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 200);
    ctx.lineTo(300, 220);
    ctx.lineTo(500, 380);
    ctx.lineTo(760, 400);
    ctx.stroke();

    // Evacuation overlay line
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(60, 180);
    ctx.lineTo(310, 190);
    ctx.lineTo(540, 310);
    ctx.lineTo(720, 280);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [waterRaster, gridWidth, gridHeight, currentHour]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-[#090d16] shadow-2xl">
      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        className="w-full h-full object-cover block"
      />
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1 font-mono text-[10px] text-slate-400 bg-slate-950/70 p-2 rounded border border-slate-800 backdrop-blur-md">
        <span>COORDINATES: 29.9511° N, 90.0715° W</span>
        <span>RESOLUTION: 10m HYDRO-DEM</span>
      </div>
    </div>
  );
};
