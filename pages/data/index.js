const { getList, setList } = require("../../utils/storage");

const DATA_KEYS = [
  { key: "daily_todos", label: "待办" },
  { key: "daily_habits", label: "打卡" },
  { key: "daily_schedule", label: "日程" },
  { key: "daily_finance", label: "记账" }
];

function buildStats() {
  return DATA_KEYS.map((item) => ({
    ...item,
    count: getList(item.key).length
  }));
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") {
    throw new Error("数据结构不正确");
  }

  const normalized = {};
  for (const item of DATA_KEYS) {
    const list = payload.data[item.key];
    if (!Array.isArray(list)) {
      throw new Error(`缺少或非法字段: ${item.key}`);
    }
    normalized[item.key] = list;
  }

  return normalized;
}

Page({
  data: {
    stats: [],
    exportText: "",
    importText: "",
    lastExportAt: ""
  },

  onShow() {
    this.refreshStats();
  },

  refreshStats() {
    this.setData({ stats: buildStats() });
  },

  generateExport() {
    const payload = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      data: DATA_KEYS.reduce((acc, item) => {
        acc[item.key] = getList(item.key);
        return acc;
      }, {})
    };

    this.setData({
      exportText: JSON.stringify(payload, null, 2),
      lastExportAt: payload.exportedAt
    });

    wx.showToast({ title: "导出内容已生成", icon: "success" });
  },

  copyExport() {
    const text = this.data.exportText || "";
    if (!text) {
      wx.showToast({ title: "请先生成导出内容", icon: "none" });
      return;
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: "已复制到剪贴板", icon: "success" });
      }
    });
  },

  onImportInput(e) {
    this.setData({ importText: e.detail.value || "" });
  },

  importData() {
    const raw = (this.data.importText || "").trim();
    if (!raw) {
      wx.showToast({ title: "请粘贴导入内容", icon: "none" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      wx.showToast({ title: "JSON 解析失败", icon: "none" });
      return;
    }

    let normalized;
    try {
      normalized = normalizePayload(parsed);
    } catch (err) {
      wx.showToast({ title: err.message || "导入结构不正确", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认导入",
      content: "将覆盖当前四个模块数据，是否继续？",
      success: (res) => {
        if (!res.confirm) return;
        for (const item of DATA_KEYS) {
          setList(item.key, normalized[item.key]);
        }
        this.setData({ importText: "" });
        this.refreshStats();
        wx.showToast({ title: "导入成功", icon: "success" });
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: "确认清空",
      content: "将清空待办、打卡、日程、记账全部数据，是否继续？",
      success: (res) => {
        if (!res.confirm) return;
        for (const item of DATA_KEYS) {
          setList(item.key, []);
        }
        this.setData({ exportText: "", importText: "", lastExportAt: "" });
        this.refreshStats();
        wx.showToast({ title: "已清空", icon: "success" });
      }
    });
  }
});
