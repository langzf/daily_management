const assert = require('assert');
const { formatDate, formatDayKey, shiftDayKey, isYesterday } = require('../utils/date');
assert.strictEqual(formatDate('2026-04-06T08:00:00+08:00').startsWith('2026-04-06'), true);
assert.strictEqual(formatDate('bad-date'), '');
assert.strictEqual(formatDayKey('2026-04-06T08:00:00+08:00'), '2026-04-06');
assert.strictEqual(shiftDayKey('2026-04-06', -1), '2026-04-05');
assert.strictEqual(isYesterday('2026-04-05', '2026-04-06'), true);
console.log('unit-ok');
