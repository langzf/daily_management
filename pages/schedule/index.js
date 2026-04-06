const { getList, setList, nowId } = require("../../utils/storage");
const { formatDayKey, parseDateTime } = require("../../utils/date");
const KEY = "daily_schedule";
const FILTERS = ["all", "pending", "today", "overdue", "done"];

function formatDateAndTime(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return { dateText: "", timeText: "" };
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return {
    dateText: `${yyyy}-${mm}-${dd}`,
    timeText: `${hh}:${mi}`
  };
}

function resolveStatus(item, nowTs, todayKey) {
  if (item.done) return "done";
  if (!Number.isFinite(item.timestamp)) return "pending";
  if (formatDayKey(item.timestamp) === todayKey) return "today";
  if (item.timestamp < nowTs) return "overdue";
  return "pending";
}

function normalizeSchedule(raw, nowTs, todayKey) {
  const fromTimestamp = Number(raw.timestamp);
  const parsedTs = Number.isFinite(fromTimestamp) ? fromTimestamp : parseDateTime(raw.dateText, raw.timeText);
  const timestamp = Number.isFinite(parsedTs) ? parsedTs : NaN;
  const fallback = Number.isFinite(timestamp) ? formatDateAndTime(timestamp) : { dateText: "", timeText: "" };
  const dateText = raw.dateText || fallback.dateText;
  const timeText = raw.timeText || fallback.timeText;
  const done = Boolean(raw.done);
  const status = resolveStatus({ done, timestamp }, nowTs, todayKey);

  return {
    id: raw.id || nowId("schedule"),
    title: String(raw.title || "").trim(),
    dateText,
    timeText,
    timestamp,
    tag: String(raw.tag || "").trim(),
    done,
    status,
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now())
  };
}

function sortSchedules(list) {
  const rank = { overdue: 1, today: 2, pending: 3, done: 4 };
  return [...list].sort((a, b) => {
    const statusDiff = (rank[a.status] || 99) - (rank[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;
    if (Number.isFinite(a.timestamp) && Number.isFinite(b.timestamp) && a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return b.createdAt - a.createdAt;
  });
}

Page({
  data: {
    title: "",
    dateText: "",
    timeText: "",
    tag: "",
    filter: "all",
    list: [],
    displayList: [],
    summary: {
      total: 0,
      pending: 0,
      today: 0,
      overdue: 0,
      done: 0
    }
  },

  onShow() {
    this.refresh();
  },

  onTitle(e) {
    this.setData({ title: e.detail.value || "" });
  },

  onDateChange(e) {
    this.setData({ dateText: e.detail.value || "" });
  },

  onTimeChange(e) {
    this.setData({ timeText: e.detail.value || "" });
  },

  onTag(e) {
    this.setData({ tag: e.detail.value || "" });
  },

  setFilter(e) {
    const value = e.currentTarget.dataset.value;
    if (!FILTERS.includes(value)) return;
    this.setData({ filter: value });
    this.refresh();
  },

  buildViewModel(sourceList) {
    const nowTs = Date.now();
    const todayKey = formatDayKey(nowTs);
    const normalized = sourceList.map((item) => normalizeSchedule(item, nowTs, todayKey)).filter((item) => item.title);
    const sorted = sortSchedules(normalized);
    const summary = {
      total: sorted.length,
      pending: sorted.filter((item) => item.status === "pending").length,
      today: sorted.filter((item) => item.status === "today").length,
      overdue: sorted.filter((item) => item.status === "overdue").length,
      done: sorted.filter((item) => item.status === "done").length
    };
    const displayList = this.data.filter === "all" ? sorted : sorted.filter((item) => item.status === this.data.filter);
    return {
      list: sorted,
      displayList,
      summary
    };
  },

  refresh() {
    this.setData(this.buildViewModel(getList(KEY)));
  },

  addSchedule() {
    const title = (this.data.title || "").trim();
    const dateText = (this.data.dateText || "").trim();
    const timeText = (this.data.timeText || "").trim();
    const tag = (this.data.tag || "").trim();
    if (!title || !dateText || !timeText) {
      wx.showToast({ title: "请填写完整信息", icon: "none" });
      return;
    }
    if (title.length > 50) {
      wx.showToast({ title: "事项名称请控制在50字以内", icon: "none" });
      return;
    }
    const timestamp = parseDateTime(dateText, timeText);
    if (!Number.isFinite(timestamp)) {
      wx.showToast({ title: "时间格式不正确", icon: "none" });
      return;
    }
    const list = getList(KEY);
    const now = Date.now();
    list.unshift({ id: nowId("schedule"), title, dateText, timeText, timestamp, tag, done: false, createdAt: now, updatedAt: now });
    setList(KEY, list);
    this.setData({ title: "", dateText: "", timeText: "", tag: "" });
    this.refresh();
  },

  toggleDone(e) {
    const id = e.currentTarget.dataset.id;
    const now = Date.now();
    const list = getList(KEY).map((item) => (item.id === id ? { ...item, done: !item.done, updatedAt: now } : item));
    setList(KEY, list);
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).filter((item) => item.id !== id);
    setList(KEY, list);
    this.refresh();
  }
});
