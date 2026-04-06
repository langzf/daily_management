const { getList, setList, nowId } = require("../../utils/storage");
const KEY = "daily_habits";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

Page({
  data: {
    newName: "",
    list: []
  },

  onShow() {
    this.refresh();
  },

  onInput(e) {
    this.setData({ newName: e.detail.value || "" });
  },

  refresh() {
    this.setData({ list: getList(KEY) });
  },

  addHabit() {
    const name = (this.data.newName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入习惯名称", icon: "none" });
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
    const today = todayKey();
    const list = getList(KEY).map((item) => {
      if (item.id !== id) return item;
      if (item.lastCheckDate === today) return item;
      return {
        ...item,
        streak: (item.streak || 0) + 1,
        checkedToday: true,
        lastCheckDate: today
      };
    });
    setList(KEY, list);
    this.refresh();
  }
});
