const fs = require('fs');
const path = require('path');

const distDir = path.join('dist', 'miniprogram');
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const include = ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'utils'];
for (const item of include) {
  if (fs.existsSync(item)) {
    fs.cpSync(item, path.join(distDir, item), { recursive: true });
  }
}

console.log('build-ok: output ->', distDir);
