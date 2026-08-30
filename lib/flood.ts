import type { DemData, ForcingData } from './types';

export interface FloodSimOptions {
  dem: DemData;
  forcing: ForcingData;
  step: number;
  barriers?: Array<{
    id: string;
    location: [number, number];
    height: number;
    active: boolean;
  }>;
}

export interface FloodSimResult {
  depthGrid: Float32Array;
  floodedCellsCount: number;
  maxDepth: number;
  activeRoadCount: number;
  floodedRoadCount: number;
}

export function runFloodSimulation(options: FloodSimOptions): FloodSimResult {
  const { dem, forcing, step, barriers = [] } = options;
  const currentStepData = forcing.steps?.[step] || { surge: 1.2, tide: 0.8, rainfall: 15 };
  
  const width = dem.width || 128;
  const height = dem.height || 128;
  const totalCells = width * height;
  const depthGrid = new Float32Array(totalCells);

  const waterLevel = currentStepData.surge + currentStepData.tide + (currentStepData.rainfall * 0.015);
  let floodedCells = 0;
  let maxDepth = 0;

  for (let i = 0; i < totalCells; i++) {
    const groundElevation = dem.elevation[i];
    
    // Check barrier protection
    let barrierEffectiveHeight = 0;
    for (const b of barriers) {
      if (b.active) {
        // barrier coverage impact factor
        barrierEffectiveHeight = Math.max(barrierEffectiveHeight, b.height);
      }
    }

    const effectiveWaterLevel = Math.max(0, waterLevel - barrierEffectiveHeight * 0.35);
    const depth = Math.max(0, effectiveWaterLevel - groundElevation);

    if (depth > 0.05) {
      depthGrid[i] = depth;
      floodedCells++;
      if (depth > maxDepth) maxDepth = depth;
    } else {
      depthGrid[i] = 0;
    }
  }

  const floodedRatio = floodedCells / totalCells;
  const totalRoadsEst = 160;
  const floodedRoadCount = Math.min(totalRoadsEst, Math.round(floodedRatio * totalRoadsEst * 2.8));
  const activeRoadCount = Math.max(0, totalRoadsEst - floodedRoadCount);

  return {
    depthGrid,
    floodedCellsCount: floodedCells,
    maxDepth,
    activeRoadCount,
    floodedRoadCount
  };
}
