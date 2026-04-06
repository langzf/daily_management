const assert = require('assert');
const { formatDate, formatDayKey, shiftDayKey, isYesterday, formatMonthKey, parseDateTime } = require('../../utils/date');

assert.strictEqual(formatDate('2026-04-06T08:00:00+08:00').includes('2026-04-06'), true);
assert.strictEqual(formatDate(''), '');
assert.strictEqual(formatDayKey('2026-04-06T08:00:00+08:00'), '2026-04-06');
assert.strictEqual(shiftDayKey('2026-04-06', -1), '2026-04-05');
assert.strictEqual(isYesterday('2026-04-05', '2026-04-06'), true);
assert.strictEqual(isYesterday('2026-04-04', '2026-04-06'), false);
assert.strictEqual(formatMonthKey('2026-04-06T08:00:00+08:00'), '2026-04');
assert.strictEqual(Number.isNaN(parseDateTime('2026-04-06', '08:30')), false);
assert.strictEqual(Number.isNaN(parseDateTime('', '08:30')), true);
console.log('date-test-ok');
