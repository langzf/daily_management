const { getList, setList, nowId } = require("../../utils/storage");
const { formatDayKey, formatMonthKey, parseDateTime } = require("../../utils/date");
const KEY = "daily_finance";
const TYPES = ["expense", "income"];

function normalizeRecord(raw) {
  const type = TYPES.includes(raw.type) ? raw.type : "expense";
  const amount = Number(raw.amount || 0);
  const fromTimestamp = Number(raw.timestamp);
  const timestamp = Number.isFinite(fromTimestamp)
    ? fromTimestamp
    : parseDateTime(raw.dateText || formatDayKey(raw.createdAt), "00:00");
  const dateText = raw.dateText || formatDayKey(timestamp || raw.createdAt);
  return {
    id: raw.id || nowId("bill"),
    note: String(raw.note || "").trim(),
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    amountText: Number.isFinite(amount) ? Number(amount.toFixed(2)).toFixed(2) : "0.00",
    type,
    category: String(raw.category || "").trim(),
    dateText,
    monthKey: formatMonthKey(dateText),
    timestamp,
    createdAt: Number(raw.createdAt || Date.now())
  };
}

function sortRecords(list) {
  return [...list].sort((a, b) => {
    if (Number.isFinite(a.timestamp) && Number.isFinite(b.timestamp) && a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return b.createdAt - a.createdAt;
  });
}

Page({
  data: {
    note: "",
    amount: "",
    type: "expense",
    category: "",
    dateText: "",
    filterMonth: "",
    list: [],
    displayList: [],
    summary: {
      income: "0.00",
      expense: "0.00",
      balance: "0.00"
    }
  },

  onShow() {
    if (!this.data.dateText) {
      this.setData({ dateText: formatDayKey() });
    }
    if (!this.data.filterMonth) {
      this.setData({ filterMonth: formatMonthKey() });
    }
    this.refresh();
  },

  onNote(e) {
    this.setData({ note: e.detail.value || "" });
  },

  onAmount(e) {
    this.setData({ amount: e.detail.value || "" });
  },

  onCategory(e) {
    this.setData({ category: e.detail.value || "" });
  },

  onDateChange(e) {
    this.setData({ dateText: e.detail.value || "" });
  },

  onTypeChange(e) {
    const value = e.currentTarget.dataset.value;
    if (!TYPES.includes(value)) return;
    this.setData({ type: value });
  },

  onQuickCategory(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ category: value || "" });
  },

  onFilterMonthChange(e) {
    const dateText = e.detail.value || "";
    this.setData({ filterMonth: formatMonthKey(dateText) });
    this.refresh();
  },

  clearMonthFilter() {
    this.setData({ filterMonth: "" });
    this.refresh();
  },

  refresh() {
    const normalized = sortRecords(getList(KEY).map(normalizeRecord).filter((item) => item.note && item.amount > 0));
    const selectedMonth = this.data.filterMonth || "";
    const displayList = selectedMonth ? normalized.filter((item) => item.monthKey === selectedMonth) : normalized;
    const income = displayList
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);
    const expense = displayList
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
    this.setData({
      list: normalized,
      displayList,
      summary: {
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: (income - expense).toFixed(2)
      }
    });
  },

  addRecord() {
    const note = (this.data.note || "").trim();
    const amount = Number(this.data.amount || 0);
    const dateText = (this.data.dateText || "").trim();
    const category = (this.data.category || "").trim();
    if (!note || !(amount > 0) || !dateText) {
      wx.showToast({ title: "请输入有效账单", icon: "none" });
      return;
    }
    if (note.length > 50) {
      wx.showToast({ title: "用途请控制在50字以内", icon: "none" });
      return;
    }
    const type = TYPES.includes(this.data.type) ? this.data.type : "expense";
    const timestamp = parseDateTime(dateText, "00:00");
    const list = getList(KEY);
    list.unshift({
      id: nowId("bill"),
      note,
      amount: Number(amount.toFixed(2)),
      type,
      category,
      dateText,
      monthKey: formatMonthKey(dateText),
      timestamp,
      createdAt: Date.now()
    });
    setList(KEY, list);
    this.setData({ note: "", amount: "", category: "", type: "expense" });
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).filter((item) => item.id !== id);
    setList(KEY, list);
    this.refresh();
  }
});
