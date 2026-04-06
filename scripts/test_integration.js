const fs = require('fs');
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
console.log('integration-ok');
