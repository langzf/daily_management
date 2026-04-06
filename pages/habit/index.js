const { getList, setList, nowId } = require("../../utils/storage");
const { formatDayKey, isYesterday } = require("../../utils/date");
const KEY = "daily_habits";

function normalizeHabit(item, today) {
  const lastCheckDate = item.lastCheckDate || "";
  const checkedToday = lastCheckDate === today;
  return {
    id: item.id || nowId("habit"),
    name: String(item.name || "").trim(),
    streak: Number(item.streak || 0),
    checkedToday,
    lastCheckDate
  };
}

Page({
  data: {
    newName: "",
    list: [],
    summary: {
      total: 0,
      doneToday: 0
    }
  },

  onShow() {
    this.refresh();
  },

  onInput(e) {
    this.setData({ newName: e.detail.value || "" });
  },

  refresh() {
    const today = formatDayKey();
    const normalized = getList(KEY).map((item) => normalizeHabit(item, today)).filter((item) => item.name);
    const doneToday = normalized.filter((item) => item.checkedToday).length;
    this.setData({
      list: normalized,
      summary: {
        total: normalized.length,
        doneToday
      }
    });
  },

  addHabit() {
    const name = (this.data.newName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入习惯名称", icon: "none" });
      return;
    }
    if (name.length > 30) {
      wx.showToast({ title: "习惯名称请控制在30字以内", icon: "none" });
      return;
    }
    const list = getList(KEY);
    list.unshift({ id: nowId("habit"), name, streak: 0, checkedToday: false, lastCheckDate: "" });
    setList(KEY, list);
    this.setData({ newName: "" });
    this.refresh();
  },

  checkIn(e) {
    const id = e.currentTarget.dataset.id;
    const today = formatDayKey();
    const list = getList(KEY).map((raw) => {
      const item = normalizeHabit(raw, today);
      if (item.id !== id) return item;
      if (item.checkedToday) return item;
      const nextStreak = isYesterday(item.lastCheckDate, today) ? item.streak + 1 : 1;
      return {
        ...item,
        streak: nextStreak,
        checkedToday: true,
        lastCheckDate: today
      };
    });
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
