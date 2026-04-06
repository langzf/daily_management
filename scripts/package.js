const fs = require('fs');
const path = require('path');

const outDir = path.join('release', 'package');
fs.rmSync('release', { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const miniDist = path.join('dist', 'miniprogram');
const backendDist = path.join('dist', 'backend');
if (!fs.existsSync(miniDist)) {
  throw new Error('dist/miniprogram not found, run build first');
}
if (!fs.existsSync(backendDist)) {
  throw new Error('dist/backend not found, run build first');
}

fs.cpSync(miniDist, path.join(outDir, 'miniprogram'), { recursive: true });
fs.cpSync(backendDist, path.join(outDir, 'backend'), { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      app: 'daily_management',
      version: '0.2.0',
      artifacts: ['miniprogram', 'backend']
    },
    null,
    2
  )
);

console.log('package-ok:', outDir);
