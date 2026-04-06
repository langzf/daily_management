const fs = require('fs');
const pages = ['todo', 'habit', 'schedule', 'finance', 'data'];
for (const name of pages) {
  const file = `pages/${name}/index.wxml`;
  if (!fs.existsSync(file)) {
    throw new Error(`missing e2e page template: ${file}`);
  }
}
console.log('e2e-ok');
