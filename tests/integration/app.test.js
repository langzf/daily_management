const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
if (!Array.isArray(app.pages) || app.pages.length < 4) {
  throw new Error('app pages not configured correctly');
}
console.log('app-integration-test-ok');
