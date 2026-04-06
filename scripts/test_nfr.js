const fs = require('fs');
const stat = fs.statSync('app.wxss');
if (stat.size > 200 * 1024) {
  throw new Error('app.wxss too large');
}
console.log('nfr-ok');
