const { getList, setList } = require('../../utils/storage');

const DATA_KEYS = [
  { key: 'daily_todos', label: '待办' },
  { key: 'daily_habits', label: '打卡' },
  { key: 'daily_schedule', label: '日程' },
  { key: 'daily_finance', label: '记账' }
];

const SYNC_BASE_URL_KEY = 'daily_sync_base_url';
const SYNC_USER_ID_KEY = 'daily_sync_user_id';
const DEFAULT_SYNC_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_SYNC_USER_ID = 'demo_user';

function buildStats() {
  return DATA_KEYS.map((item) => ({
    ...item,
    count: getList(item.key).length
  }));
}

function buildSnapshotData() {
  return DATA_KEYS.reduce((acc, item) => {
    acc[item.key] = getList(item.key);
    return acc;
  }, {});
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

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function isValidUserId(userId) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(userId);
}

function requestJSON({ url, method, data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout: 8000,
      success: (resp) => {
        const body = resp.data || {};
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          resolve(body);
          return;
        }
        reject(new Error(body.error || `请求失败: ${resp.statusCode}`));
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '网络请求失败'));
      }
    });
  });
}

Page({
  data: {
    stats: [],
    exportText: '',
    importText: '',
    lastExportAt: '',
    apiBaseUrl: DEFAULT_SYNC_BASE_URL,
    apiUserId: DEFAULT_SYNC_USER_ID,
    syncStatus: ''
  },

  onShow() {
    this.loadSyncConfig();
    this.refreshStats();
  },

  loadSyncConfig() {
    const baseUrl = normalizeBaseUrl(wx.getStorageSync(SYNC_BASE_URL_KEY) || DEFAULT_SYNC_BASE_URL);
    const userId = String(wx.getStorageSync(SYNC_USER_ID_KEY) || DEFAULT_SYNC_USER_ID).trim();
    this.setData({
      apiBaseUrl: baseUrl || DEFAULT_SYNC_BASE_URL,
      apiUserId: userId || DEFAULT_SYNC_USER_ID
    });
  },

  refreshStats() {
    this.setData({ stats: buildStats() });
  },

  generateExport() {
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: buildSnapshotData()
    };

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

  saveSyncConfig() {
    const apiBaseUrl = normalizeBaseUrl(this.data.apiBaseUrl);
    const apiUserId = String(this.data.apiUserId || '').trim();

    if (!/^https?:\/\//.test(apiBaseUrl)) {
      wx.showToast({ title: 'API地址需以 http/https 开头', icon: 'none' });
      return;
    }
    if (!isValidUserId(apiUserId)) {
      wx.showToast({ title: 'userId 仅支持字母数字_-', icon: 'none' });
      return;
    }

    wx.setStorageSync(SYNC_BASE_URL_KEY, apiBaseUrl);
    wx.setStorageSync(SYNC_USER_ID_KEY, apiUserId);
    this.setData({
      apiBaseUrl,
      apiUserId,
      syncStatus: '同步配置已保存'
    });

    wx.showToast({ title: '配置已保存', icon: 'success' });
  },

  uploadToServer() {
    const apiBaseUrl = normalizeBaseUrl(this.data.apiBaseUrl);
    const apiUserId = String(this.data.apiUserId || '').trim();

    if (!/^https?:\/\//.test(apiBaseUrl)) {
      wx.showToast({ title: '请先填写有效API地址', icon: 'none' });
      return;
    }
    if (!isValidUserId(apiUserId)) {
      wx.showToast({ title: '请先填写有效userId', icon: 'none' });
      return;
    }

    const payload = {
      userId: apiUserId,
      data: buildSnapshotData()
    };

    wx.showLoading({ title: '上传中', mask: true });
    requestJSON({
      url: `${apiBaseUrl}/api/v1/snapshot`,
      method: 'PUT',
      data: payload
    })
      .then((resp) => {
        if (!resp || resp.ok !== true) {
          throw new Error((resp && resp.error) || '后端返回异常');
        }
        const time = resp.savedAt || new Date().toISOString();
        this.setData({ syncStatus: `上传成功：${time}` });
        wx.showToast({ title: '上传成功', icon: 'success' });
      })
      .catch((err) => {
        const message = (err && err.message) || '上传失败';
        this.setData({ syncStatus: `上传失败：${message}` });
        wx.showToast({ title: message, icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  downloadFromServer() {
    const apiBaseUrl = normalizeBaseUrl(this.data.apiBaseUrl);
    const apiUserId = String(this.data.apiUserId || '').trim();

    if (!/^https?:\/\//.test(apiBaseUrl)) {
      wx.showToast({ title: '请先填写有效API地址', icon: 'none' });
      return;
    }
    if (!isValidUserId(apiUserId)) {
      wx.showToast({ title: '请先填写有效userId', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下载中', mask: true });
    requestJSON({
      url: `${apiBaseUrl}/api/v1/snapshot?userId=${encodeURIComponent(apiUserId)}`,
      method: 'GET'
    })
      .then((resp) => {
        if (!resp || resp.ok !== true) {
          throw new Error((resp && resp.error) || '后端返回异常');
        }
        const normalized = normalizePayload({ data: resp.data || {} });
        wx.showModal({
          title: '确认覆盖',
          content: '下载数据会覆盖当前本地四个模块数据，是否继续？',
          success: (modalRes) => {
            if (!modalRes.confirm) return;
            for (const item of DATA_KEYS) {
              setList(item.key, normalized[item.key]);
            }
            this.refreshStats();
            const time = resp.fetchedAt || new Date().toISOString();
            this.setData({ syncStatus: `下载成功：${time}`, importText: '', exportText: '' });
            wx.showToast({ title: '下载成功', icon: 'success' });
          }
        });
      })
      .catch((err) => {
        const message = (err && err.message) || '下载失败';
        this.setData({ syncStatus: `下载失败：${message}` });
        wx.showToast({ title: message, icon: 'none' });
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
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  }
});
