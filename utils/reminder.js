function normalizeLeadMinutes(input, fallback) {
  const lead = Number(input);
  if (!Number.isFinite(lead) || lead < 0) return fallback;
  return Math.floor(lead);
}

function computeReminderAt(timestamp, leadMinutes) {
  if (!Number.isFinite(timestamp)) return NaN;
  const lead = normalizeLeadMinutes(leadMinutes, 0);
  return timestamp - lead * 60 * 1000;
}

function reminderToken(item) {
  return `${item.id}|${item.timestamp}|${item.remindBeforeMin}`;
}

function collectDueReminders(list, ackMap, nowTs) {
  const ack = ackMap && typeof ackMap === "object" ? ackMap : {};
  const due = [];

  for (const item of list) {
    if (!item || !item.id || item.done) continue;
    if (!item.remindEnabled) continue;
    if (!Number.isFinite(item.reminderAt) || item.reminderAt > nowTs) continue;
    const token = reminderToken(item);
    if (ack[token]) continue;
    due.push(item);
  }

  return due;
}

function markReminderAck(ackMap, reminders, ackTs) {
  const base = ackMap && typeof ackMap === "object" ? { ...ackMap } : {};
  const ts = Number.isFinite(ackTs) ? ackTs : Date.now();
  for (const item of reminders) {
    if (!item || !item.id) continue;
    base[reminderToken(item)] = ts;
  }
  return base;
}

function pruneAckBySchedules(ackMap, schedules) {
  const base = ackMap && typeof ackMap === "object" ? ackMap : {};
  const valid = new Set(
    (Array.isArray(schedules) ? schedules : [])
      .filter((item) => item && item.id && Number.isFinite(item.timestamp))
      .map((item) => reminderToken(item))
  );

  const next = {};
  for (const [token, value] of Object.entries(base)) {
    if (valid.has(token)) {
      next[token] = value;
    }
  }
  return next;
}

module.exports = {
  normalizeLeadMinutes,
  computeReminderAt,
  reminderToken,
  collectDueReminders,
  markReminderAck,
  pruneAckBySchedules
};
