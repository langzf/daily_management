const { getList, setList, nowId } = require("../../utils/storage");
const KEY = "daily_finance";

Page({
  data: {
    note: "",
    amount: "",
    list: [],
    total: "0.00"
  },

  onShow() {
    this.refresh();
  },

  onNote(e) {
    this.setData({ note: e.detail.value || "" });
  },

  onAmount(e) {
    this.setData({ amount: e.detail.value || "" });
  },

  refresh() {
    const list = getList(KEY);
    const total = list.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2);
    this.setData({ list, total });
  },

  addRecord() {
    const note = (this.data.note || "").trim();
    const amount = Number(this.data.amount || 0);
    if (!note || !(amount > 0)) {
      wx.showToast({ title: "请输入有效账单", icon: "none" });
      return;
    }
    const list = getList(KEY);
    list.unshift({ id: nowId("bill"), note, amount: amount.toFixed(2), createdAt: Date.now() });
    setList(KEY, list);
    this.setData({ note: "", amount: "" });
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).filter((item) => item.id !== id);
    setList(KEY, list);
    this.refresh();
  }
});
