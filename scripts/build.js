const fs = require('fs');
const path = require('path');

const distDir = path.join('dist');
const miniDir = path.join(distDir, 'miniprogram');
const backendDir = path.join(distDir, 'backend');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(miniDir, { recursive: true });
fs.mkdirSync(backendDir, { recursive: true });

const miniInclude = ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'utils'];
for (const item of miniInclude) {
  if (fs.existsSync(item)) {
    fs.cpSync(item, path.join(miniDir, item), { recursive: true });
  }
}

const backendInclude = ['backend/src', 'backend/db', 'backend/package.json', 'backend/README.md'];
for (const item of backendInclude) {
  if (fs.existsSync(item)) {
    const target = path.join(backendDir, item.replace(/^backend\//, ''));
    fs.cpSync(item, target, { recursive: true });
  }
}

console.log('build-ok: output ->', distDir);
