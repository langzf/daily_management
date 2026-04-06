function formatDate(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatDayKey(input) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDayKey(dayKey, delta) {
  if (!dayKey) return "";
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + delta);
  return formatDayKey(d);
}

function isYesterday(targetDayKey, referenceDayKey) {
  if (!targetDayKey) return false;
  const ref = referenceDayKey || formatDayKey();
  return targetDayKey === shiftDayKey(ref, -1);
}

function formatMonthKey(input) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseDateTime(dateText, timeText) {
  if (!dateText || !timeText) return NaN;
  const d = new Date(`${dateText}T${timeText}:00`);
  return d.getTime();
}

module.exports = {
  formatDate,
  formatDayKey,
  shiftDayKey,
  isYesterday,
  formatMonthKey,
  parseDateTime
};
