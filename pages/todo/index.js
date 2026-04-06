const { getList, setList, nowId } = require("../../utils/storage");
const KEY = "daily_todos";
const PRIORITY_OPTIONS = ["low", "medium", "high"];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

function normalizeTodo(item) {
  return {
    id: item.id || nowId("todo"),
    text: String(item.text || "").trim(),
    done: Boolean(item.done),
    priority: PRIORITY_OPTIONS.includes(item.priority) ? item.priority : "medium",
    createdAt: Number(item.createdAt || Date.now()),
    updatedAt: Number(item.updatedAt || Date.now())
  };
}

function sortTodos(list) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.createdAt - a.createdAt;
  });
}

Page({
  data: {
    newText: "",
    newPriority: "medium",
    filter: "all",
    list: [],
    displayList: [],
    stats: {
      total: 0,
      active: 0,
      done: 0
    }
  },

  onShow() {
    this.refresh();
  },

  onInput(e) {
    this.setData({ newText: e.detail.value || "" });
  },

  onPriorityChange(e) {
    const value = e.currentTarget.dataset.value;
    if (!PRIORITY_OPTIONS.includes(value)) return;
    this.setData({ newPriority: value });
  },

  setFilter(e) {
    const value = e.currentTarget.dataset.value;
    if (!["all", "active", "done"].includes(value)) return;
    this.setData({ filter: value });
    this.refresh();
  },

  buildViewModel(list) {
    const sorted = sortTodos(list.map(normalizeTodo));
    const total = sorted.length;
    const done = sorted.filter((item) => item.done).length;
    const active = total - done;
    let displayList = sorted;
    if (this.data.filter === "active") {
      displayList = sorted.filter((item) => !item.done);
    } else if (this.data.filter === "done") {
      displayList = sorted.filter((item) => item.done);
    }
    return {
      list: sorted,
      displayList,
      stats: { total, active, done }
    };
  },

  refresh() {
    const model = this.buildViewModel(getList(KEY));
    this.setData(model);
  },

  addTodo() {
    const text = (this.data.newText || "").trim();
    if (!text) {
      wx.showToast({ title: "请输入内容", icon: "none" });
      return;
    }
    if (text.length > 100) {
      wx.showToast({ title: "内容请控制在100字以内", icon: "none" });
      return;
    }
    const list = getList(KEY);
    const now = Date.now();
    list.unshift({
      id: nowId("todo"),
      text,
      done: false,
      priority: this.data.newPriority || "medium",
      createdAt: now,
      updatedAt: now
    });
    setList(KEY, list);
    this.setData({ newText: "", newPriority: "medium" });
    this.refresh();
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    const now = Date.now();
    const list = getList(KEY).map((item) => {
      if (item.id !== id) return item;
      return { ...item, done: !item.done, updatedAt: now };
    });
    setList(KEY, list);
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const list = getList(KEY).filter((item) => item.id !== id);
    setList(KEY, list);
    this.refresh();
  },

  clearCompleted() {
    const list = getList(KEY).filter((item) => !item.done);
    setList(KEY, list);
    this.refresh();
  }
});
