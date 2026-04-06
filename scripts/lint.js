const fs = require('fs');
const required = [
  'app.js',
  'app.json',
  'pages/todo/index.js',
  'pages/habit/index.js',
  'pages/schedule/index.js',
  'pages/finance/index.js',
  'pages/data/index.js',
  'pages/data/index.wxml'
];
const missing = required.filter((f) => !fs.existsSync(f));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}
console.log('lint-ok: required files exist');
