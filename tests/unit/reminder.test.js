const assert = require('assert');
const { computeReminderAt, collectDueReminders, markReminderAck, pruneAckBySchedules } = require('../../utils/reminder');

const nowTs = 200000;
const list = [
  { id: 'r1', timestamp: 210000, remindBeforeMin: 1, reminderAt: 140000, remindEnabled: true, done: false },
  { id: 'r2', timestamp: 230000, remindBeforeMin: 1, reminderAt: 220000, remindEnabled: true, done: false }
];

assert.strictEqual(computeReminderAt(100000, 15), 100000 - 15 * 60 * 1000);
const due = collectDueReminders(list, {}, nowTs);
assert.strictEqual(due.length, 1);

const ack = markReminderAck({}, due, nowTs);
assert.strictEqual(Object.keys(ack).length, 1);

const pruned = pruneAckBySchedules(ack, list);
assert.strictEqual(Object.keys(pruned).length, 1);
console.log('reminder-test-ok');
