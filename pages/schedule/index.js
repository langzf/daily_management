const { getList, setList, nowId } = require("../../utils/storage");
const KEY = "daily_schedule";

Page({
  data: {
    title: "",
    timeText: "",
    list: []
  },

  onShow() {
    this.refresh();
  },

  onTitle(e) {
    this.setData({ title: e.detail.value || "" });
  },

  onTime(e) {
    this.setData({ timeText: e.detail.value || "" });
  },

  refresh() {
    this.setData({ list: getList(KEY) });
  },

  addSchedule() {
    const title = (this.data.title || "").trim();
    const timeText = (this.data.timeText || "").trim();
    if (!title || !timeText) {
      wx.showToast({ title: "请填写完整信息", icon: "none" });
      return;
    }
    const list = getList(KEY);
    list.unshift({ id: nowId("schedule"), title, timeText, createdAt: Date.now() });
    setList(KEY, list);
    this.setData({ title: "", timeText: "" });
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).filter((item) => item.id !== id);
    setList(KEY, list);
    this.refresh();
  }
});
