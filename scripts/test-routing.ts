import { findSafeRoute } from '../lib/routing';
import roadsData from '../data/roads.json';

console.log('[Test-Routing] Testing safe pathfinding algorithm...');

const mockWaterGrid = new Float32Array(128 * 128);
// simulate water depth in lower corner
for (let i = 0; i < 2000; i++) {
  mockWaterGrid[i] = 1.2;
}

const result = findSafeRoute({
  start: [-74.006, 40.7128],
  destination: [-73.985, 40.7484],
  roads: roadsData as any,
  waterGrid: mockWaterGrid
});

console.log(`[Test-Routing] Computed Path Waypoints: ${result.path.length}`);
console.log(`[Test-Routing] Total Safe Distance: ${result.distance} km`);
console.log(`[Test-Routing] Status: ${result.safe ? 'SUCCESS (Safe)' : 'BLOCKED'}`);
