import { runFloodSimulation } from '../lib/flood';
import { findSafeRoute } from '../lib/routing';
import demData from '../data/dem.json';
import forcingData from '../data/forcing.json';
import roadsData from '../data/roads.json';

console.log('[Test-Engine] Starting Verification Run...');

try {
  const result = runFloodSimulation({
    dem: demData as any,
    forcing: forcingData as any,
    step: 3,
    barriers: []
  });

  console.log(`[Test-Engine] Simulation Step 3 Computed: Inundation Cells = ${result.floodedCellsCount}`);

  const routeResult = findSafeRoute({
    start: [roadsData.features[0].geometry.coordinates[0][0], roadsData.features[0].geometry.coordinates[0][1]],
    destination: [roadsData.features[1].geometry.coordinates[0][0], roadsData.features[1].geometry.coordinates[0][1]],
    roads: roadsData as any,
    waterGrid: result.grid
  });

  console.log(`[Test-Engine] Route Computed: Path Valid = ${routeResult.success}`);
  console.log('[Test-Engine] Engine test completed successfully.');
} catch (err) {
  console.error('[Test-Engine] Error running engine test:', err);
  process.exit(1);
}
