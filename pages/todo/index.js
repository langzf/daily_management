const { getList, setList, nowId } = require("../../utils/storage");
const KEY = "daily_todos";

Page({
  data: {
    newText: "",
    list: []
  },

  onShow() {
    this.refresh();
  },

  onInput(e) {
    this.setData({ newText: e.detail.value || "" });
  },

  refresh() {
    this.setData({ list: getList(KEY) });
  },

  addTodo() {
    const text = (this.data.newText || "").trim();
    if (!text) {
      wx.showToast({ title: "请输入内容", icon: "none" });
      return;
    }
    const list = getList(KEY);
    list.unshift({ id: nowId("todo"), text, done: false, createdAt: Date.now() });
    setList(KEY, list);
    this.setData({ newText: "" });
    this.refresh();
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).map((item) => (item.id === id ? { ...item, done: !item.done } : item));
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
