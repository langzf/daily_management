const fs = require('fs');
const path = require('path');

const denyPatterns = [/github_pat_/i, /AKIA[0-9A-Z]{16}/, /BEGIN PRIVATE KEY/];
const ignoredDirs = new Set(['.git', 'dist', 'node_modules']);
const ignoredFiles = new Set(['scripts/scan_security.js']);

function scanDir(rootDir, currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const e of entries) {
    if (ignoredDirs.has(e.name)) continue;

    const fullPath = path.join(currentDir, e.name);
    if (e.isDirectory()) {
      scanDir(rootDir, fullPath);
      continue;
    }

    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (ignoredFiles.has(relPath)) continue;

    const text = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of denyPatterns) {
      if (pattern.test(text)) {
        throw new Error(`potential secret detected in ${relPath}`);
      }
    }
  }
}

scanDir('.', '.');
console.log('security-ok');
