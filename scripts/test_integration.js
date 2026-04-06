const fs = require('fs');
const { execFileSync } = require('child_process');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const requiredPages = [
  'pages/todo/index',
  'pages/habit/index',
  'pages/schedule/index',
  'pages/finance/index',
  'pages/data/index'
];

for (const p of requiredPages) {
  if (!app.pages.includes(p)) {
    throw new Error(`missing page in app.json: ${p}`);
  }
}

execFileSync(process.execPath, ['backend/tests/snapshot_api.test.js'], {
  stdio: 'inherit'
});

console.log('integration-ok');
