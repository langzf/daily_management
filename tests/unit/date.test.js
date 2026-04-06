const assert = require('assert');
const { formatDate } = require('../../utils/date');

assert.strictEqual(formatDate('2026-04-06T08:00:00+08:00').includes('2026-04-06'), true);
assert.strictEqual(formatDate(''), '');
console.log('date-test-ok');
