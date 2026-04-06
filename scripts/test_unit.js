const assert = require('assert');
const { formatDate, formatDayKey, shiftDayKey, isYesterday, formatMonthKey, parseDateTime } = require('../utils/date');
const { computeReminderAt, collectDueReminders, markReminderAck } = require('../utils/reminder');
assert.strictEqual(formatDate('2026-04-06T08:00:00+08:00').startsWith('2026-04-06'), true);
assert.strictEqual(formatDate('bad-date'), '');
assert.strictEqual(formatDayKey('2026-04-06T08:00:00+08:00'), '2026-04-06');
assert.strictEqual(shiftDayKey('2026-04-06', -1), '2026-04-05');
assert.strictEqual(isYesterday('2026-04-05', '2026-04-06'), true);
assert.strictEqual(formatMonthKey('2026-04-06T08:00:00+08:00'), '2026-04');
assert.strictEqual(Number.isNaN(parseDateTime('2026-04-06', '08:30')), false);
assert.strictEqual(computeReminderAt(100000, 15), 100000 - 15 * 60 * 1000);
const nowTs = 200000;
const due = collectDueReminders([
  { id: 'a', timestamp: 210000, remindBeforeMin: 1, reminderAt: 140000, remindEnabled: true, done: false },
  { id: 'b', timestamp: 230000, remindBeforeMin: 1, reminderAt: 210000, remindEnabled: true, done: false }
], {}, nowTs);
assert.strictEqual(due.length, 1);
const ack = markReminderAck({}, due, nowTs);
assert.strictEqual(Object.keys(ack).length, 1);
console.log('unit-ok');
