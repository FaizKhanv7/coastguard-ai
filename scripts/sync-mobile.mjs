import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');

console.log('[Sync-Mobile] Syncing standalone engine and mobile payloads...');

const filesToSync = [
  'coastguard-ai.html',
  'public/mobile.html',
  'public/coastguard-engine.js'
];

for (const file of filesToSync) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(` - Verified ${file} (${stats.size} bytes)`);
  } else {
    console.warn(` - Warning: ${file} not found.`);
  }
}

console.log('[Sync-Mobile] Sync check completed.');
