const fs = require('fs');
const path = require('path');

const outDir = path.join('release', 'package');
fs.rmSync('release', { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(path.join('dist', 'miniprogram'))) {
  throw new Error('dist/miniprogram not found, run build first');
}

fs.cpSync(path.join('dist', 'miniprogram'), path.join(outDir, 'miniprogram'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  app: 'daily_management',
  version: '0.1.0'
}, null, 2));

console.log('package-ok:', outDir);
