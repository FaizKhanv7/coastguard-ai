import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Badge } from './ui';

interface RoadFeature {
  id: string;
  name: string;
  coordinates: [number, number][];
  elevation: number;
}

interface Landmark {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
}

interface FloodMapProps {
  waterDepthGrid: number[][]; // 2D matrix of water depth
  roads: RoadFeature[];
  landmarks: Landmark[];
  activeRouteCoords?: [number, number][];
  currentWaterLevel: number;
}

export default function FloodMap({
  waterDepthGrid = [],
  roads = [],
  landmarks = [],
  activeRouteCoords = [],
  currentWaterLevel = 1.2,
}: FloodMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showRoads, setShowRoads] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);

  // Render Tactical 2D Topo-Water Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Dark Tactical Background
    ctx.fillStyle = '#070c14';
    ctx.fillRect(0, 0, width, height);

    // 2. Tactical Grid Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Render Inundation Layer
    if (showWater && waterDepthGrid.length > 0) {
      const rows = waterDepthGrid.length;
      const cols = waterDepthGrid[0]?.length || 0;
      const cellW = width / cols;
      const cellH = height / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const depth = waterDepthGrid[r][c] || 0;
          if (depth > 0.05) {
            const alpha = Math.min(0.85, 0.2 + depth * 0.4);
            if (depth > 0.8) {
              ctx.fillStyle = `rgba(14, 116, 144, ${alpha})`;
            } else if (depth > 0.3) {
              ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
            } else {
              ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.7})`;
            }
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }

    // 4. Render Roads with Status Elevation Checks
    if (showRoads) {
      roads.forEach((road) => {
        if (!road.coordinates || road.coordinates.length < 2) return;
        const isFlooded = currentWaterLevel > road.elevation + 0.3;
        const isCaution = !isFlooded && currentWaterLevel > road.elevation;

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = isFlooded ? '#f43f5e' : isCaution ? '#f59e0b' : '#10b981';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        road.coordinates.forEach(([rx, ry], idx) => {
          const px = (rx / 100) * width;
          const py = (ry / 100) * height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }

    // 5. Active Evacuation Route Highlighting
    if (activeRouteCoords.length > 1) {
      ctx.beginPath();
Here is the revamped and upgraded UI/UX suite for **CoastGuard AI**. 

Applied design principles:
- **Aesthetic Direction:** Professional Geospatial HUD / Mission Control Dark Mode (`#0b0f19` background, Slate/Navy glassmorphism, Electric Cyan `#06b6d4`, Radar Emerald `#10b981`, and Warning Amber/Rose alerts).
- **Component Architecture:** High contrast telemetry badges, responsive drawer layouts, fluid interactive scrubbers, polished canvas raster layers, and crisp typography.

---

### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #070a13;
  --bg-surface: #0e1526;
  --bg-surface-elevated: #162038;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-accent: rgba(6, 182, 212, 0.3);
  --accent-cyan: #06b6d4;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --accent-rose: #f43f5e;
}

body {
  background-color: var(--bg-primary);
  color: #f1f5f9;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  overflow: hidden;
  user-select: none;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}
::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.4);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.6);
}

/* Glassmorphism Panel */
.glass-panel {
  background: rgba(14, 21, 38, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
}

.glass-panel-elevated {
  background: rgba(22, 32, 56, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-accent);
  box-shadow: 0 14px 40px -12px rgba(6, 182, 212, 0.15);
}

/* Radar Sweep Pulse */
@keyframes radar-pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 0.3; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.radar-live {
  animation: radar-pulse 3s infinite ease-in-out;
}
