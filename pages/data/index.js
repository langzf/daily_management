const { getList, setList } = require('../../utils/storage');
const {
  DEFAULT_SYNC_BASE_URL,
  DEFAULT_SYNC_USER_ID,
  getSyncConfig,
  saveSyncConfig: persistSyncConfig,
  getSyncMeta,
  normalizeBaseUrl,
  isValidBaseUrl,
  isValidUserId,
  uploadSnapshot,
  downloadSnapshot,
  applySnapshotData,
  tryInitialPull,
  flushUpload
} = require('../../utils/sync');

const DATA_KEYS = [
  { key: 'daily_todos', label: '待办' },
  { key: 'daily_habits', label: '打卡' },
  { key: 'daily_schedule', label: '日程' },
  { key: 'daily_finance', label: '记账' }
];

function buildStats() {
  return DATA_KEYS.map((item) => ({
    ...item,
    count: getList(item.key).length
  }));
}

function buildExportPayload() {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: DATA_KEYS.reduce((acc, item) => {
      acc[item.key] = getList(item.key);
      return acc;
    }, {})
  };
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('数据结构不正确');
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
    exportText: '',
    importText: '',
    lastExportAt: '',
    apiBaseUrl: DEFAULT_SYNC_BASE_URL,
    apiUserId: DEFAULT_SYNC_USER_ID,
    autoSyncEnabled: true,
    debugSyncMode: false,
    syncStatus: '',
    lastSyncAt: ''
  },

  onShow() {
    this.loadSyncConfig();
    this.refreshStats();
    this.refreshSyncMeta();

    tryInitialPull().then(() => {
      this.refreshStats();
      this.refreshSyncMeta();
    });
  },

  loadSyncConfig() {
    const config = getSyncConfig();
    this.setData({
      apiBaseUrl: config.baseUrl || DEFAULT_SYNC_BASE_URL,
      apiUserId: config.userId || DEFAULT_SYNC_USER_ID,
      autoSyncEnabled: !!config.autoSyncEnabled,
      debugSyncMode: !!config.debugMode
    });
  },

  refreshStats() {
    this.setData({ stats: buildStats() });
  },

  refreshSyncMeta() {
    const meta = getSyncMeta();
    this.setData({
      syncStatus: meta.lastStatus || '',
      lastSyncAt: meta.lastSuccessAt || ''
    });
  },

  generateExport() {
    const payload = buildExportPayload();

    this.setData({
      exportText: JSON.stringify(payload, null, 2),
      lastExportAt: payload.exportedAt
    });

    wx.showToast({ title: '导出内容已生成', icon: 'success' });
  },

  copyExport() {
    const text = this.data.exportText || '';
    if (!text) {
      wx.showToast({ title: '请先生成导出内容', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  onImportInput(e) {
    this.setData({ importText: e.detail.value || '' });
  },

  onApiBaseUrlInput(e) {
    this.setData({ apiBaseUrl: e.detail.value || '' });
  },

  onApiUserIdInput(e) {
    this.setData({ apiUserId: e.detail.value || '' });
  },

  onAutoSyncChange(e) {
    this.setData({ autoSyncEnabled: !!e.detail.value });
  },

  onDebugSyncModeChange(e) {
    this.setData({ debugSyncMode: !!e.detail.value });
  },

  saveSyncConfig() {
    const apiBaseUrl = normalizeBaseUrl(this.data.apiBaseUrl);
    const apiUserId = String(this.data.apiUserId || '').trim();
    const autoSyncEnabled = !!this.data.autoSyncEnabled;
    const debugSyncMode = !!this.data.debugSyncMode;

    if (!isValidBaseUrl(apiBaseUrl)) {
      wx.showToast({ title: 'API地址需以 http/https 开头', icon: 'none' });
      return;
    }
    if (!isValidUserId(apiUserId)) {
      wx.showToast({ title: 'userId 仅支持字母数字_-', icon: 'none' });
      return;
    }

    const saved = persistSyncConfig({
      baseUrl: apiBaseUrl,
      userId: apiUserId,
      autoSyncEnabled,
      debugMode: debugSyncMode
    });

    this.setData({
      apiBaseUrl: saved.baseUrl,
      apiUserId: saved.userId,
      autoSyncEnabled: saved.autoSyncEnabled,
      debugSyncMode: saved.debugMode
    });

    wx.showToast({ title: '同步配置已保存', icon: 'success' });

    if (saved.autoSyncEnabled) {
      flushUpload('config-save').then(() => {
        this.refreshSyncMeta();
      });
    } else {
      this.refreshSyncMeta();
    }
  },

  debugUploadNow() {
    wx.showLoading({ title: '同步中', mask: true });
    uploadSnapshot({ reason: 'debug-manual', ignoreAutoGate: true })
      .then(() => {
        this.refreshSyncMeta();
        wx.showToast({ title: '同步完成', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '同步失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  debugDownloadNow() {
    const apiBaseUrl = normalizeBaseUrl(this.data.apiBaseUrl);
    const apiUserId = String(this.data.apiUserId || '').trim();

    if (!isValidBaseUrl(apiBaseUrl) || !isValidUserId(apiUserId)) {
      wx.showToast({ title: '请先保存有效同步配置', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下载中', mask: true });
    downloadSnapshot({ baseUrl: apiBaseUrl, userId: apiUserId })
      .then((resp) => {
        wx.showModal({
          title: '确认覆盖',
          content: '下载数据会覆盖当前本地四个模块数据，是否继续？',
          success: (modalRes) => {
            if (!modalRes.confirm) return;
            applySnapshotData(resp.data || {});
            this.refreshStats();
            this.refreshSyncMeta();
            wx.showToast({ title: '恢复完成', icon: 'success' });
          }
        });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '下载失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  importData() {
    const raw = (this.data.importText || '').trim();
    if (!raw) {
      wx.showToast({ title: '请粘贴导入内容', icon: 'none' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      wx.showToast({ title: 'JSON 解析失败', icon: 'none' });
      return;
    }

    let normalized;
    try {
      normalized = normalizePayload(parsed);
    } catch (err) {
      wx.showToast({ title: err.message || '导入结构不正确', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认导入',
      content: '将覆盖当前四个模块数据，是否继续？',
      success: (res) => {
        if (!res.confirm) return;
        for (const item of DATA_KEYS) {
          setList(item.key, normalized[item.key]);
        }
        this.setData({ importText: '' });
        this.refreshStats();
        this.refreshSyncMeta();
        wx.showToast({ title: '导入成功', icon: 'success' });
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '将清空待办、打卡、日程、记账全部数据，是否继续？',
      success: (res) => {
        if (!res.confirm) return;
        for (const item of DATA_KEYS) {
          setList(item.key, []);
        }
        this.setData({ exportText: '', importText: '', lastExportAt: '' });
        this.refreshStats();
        this.refreshSyncMeta();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  }
});
