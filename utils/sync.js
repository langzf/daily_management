const DATA_KEYS = ['daily_todos', 'daily_habits', 'daily_schedule', 'daily_finance'];

const SYNC_BASE_URL_KEY = 'daily_sync_base_url';
const SYNC_USER_ID_KEY = 'daily_sync_user_id';
const SYNC_AUTO_ENABLED_KEY = 'daily_sync_auto_enabled';
const SYNC_DEBUG_MODE_KEY = 'daily_sync_debug_mode';
const SYNC_LAST_STATUS_KEY = 'daily_sync_last_status';
const SYNC_LAST_SUCCESS_AT_KEY = 'daily_sync_last_success_at';

const DEFAULT_SYNC_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_SYNC_USER_ID = 'demo_user';
const DEFAULT_AUTO_ENABLED = true;
const DEFAULT_DEBUG_MODE = false;
const AUTO_UPLOAD_DELAY_MS = 2500;

let uploadTimer = null;
let pendingReason = '';
let uploadInFlight = false;
let suppressDepth = 0;
let initialPullTried = false;

function getWx() {
  if (typeof wx === 'undefined' || !wx) return null;
  return wx;
}

function getStorageValue(key, fallback) {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.getStorageSync !== 'function') return fallback;
  const value = wxObj.getStorageSync(key);
  return value === undefined ? fallback : value;
}

function setStorageValue(key, value) {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.setStorageSync !== 'function') return;
  wxObj.setStorageSync(key, value);
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function isValidBaseUrl(baseUrl) {
  return /^https?:\/\//.test(String(baseUrl || ''));
}

function isValidUserId(userId) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(String(userId || ''));
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return !!value;
}

function getSyncConfig() {
  return {
    baseUrl: normalizeBaseUrl(getStorageValue(SYNC_BASE_URL_KEY, DEFAULT_SYNC_BASE_URL)),
    userId: String(getStorageValue(SYNC_USER_ID_KEY, DEFAULT_SYNC_USER_ID) || '').trim(),
    autoSyncEnabled: toBoolean(getStorageValue(SYNC_AUTO_ENABLED_KEY, DEFAULT_AUTO_ENABLED), DEFAULT_AUTO_ENABLED),
    debugMode: toBoolean(getStorageValue(SYNC_DEBUG_MODE_KEY, DEFAULT_DEBUG_MODE), DEFAULT_DEBUG_MODE)
  };
}

function saveSyncConfig(config) {
  const next = config || {};
  const baseUrl = normalizeBaseUrl(next.baseUrl);
  const userId = String(next.userId || '').trim();
  const autoSyncEnabled = toBoolean(next.autoSyncEnabled, DEFAULT_AUTO_ENABLED);
  const debugMode = toBoolean(next.debugMode, DEFAULT_DEBUG_MODE);

  setStorageValue(SYNC_BASE_URL_KEY, baseUrl || DEFAULT_SYNC_BASE_URL);
  setStorageValue(SYNC_USER_ID_KEY, userId || DEFAULT_SYNC_USER_ID);
  setStorageValue(SYNC_AUTO_ENABLED_KEY, autoSyncEnabled);
  setStorageValue(SYNC_DEBUG_MODE_KEY, debugMode);

  return getSyncConfig();
}

function isSyncConfigValid(config) {
  const cfg = config || getSyncConfig();
  return isValidBaseUrl(cfg.baseUrl) && isValidUserId(cfg.userId);
}

function normalizeSnapshotData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('snapshot.data must be an object');
  }
  const out = {};
  for (const key of DATA_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new Error(`snapshot.data.${key} must be an array`);
    }
    out[key] = data[key];
  }
  return out;
}

function buildSnapshotData() {
  const out = {};
  for (const key of DATA_KEYS) {
    const list = getStorageValue(key, []);
    out[key] = Array.isArray(list) ? list : [];
  }
  return out;
}

function setSyncStatus(text) {
  setStorageValue(SYNC_LAST_STATUS_KEY, String(text || ''));
}

function setLastSuccessAt(text) {
  setStorageValue(SYNC_LAST_SUCCESS_AT_KEY, String(text || ''));
}

function getSyncMeta() {
  return {
    lastStatus: String(getStorageValue(SYNC_LAST_STATUS_KEY, '') || ''),
    lastSuccessAt: String(getStorageValue(SYNC_LAST_SUCCESS_AT_KEY, '') || '')
  };
}

function requestJSON({ url, method, data }) {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.request !== 'function') {
    return Promise.reject(new Error('wx.request is unavailable'));
  }

  return new Promise((resolve, reject) => {
    wxObj.request({
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
        reject(new Error(body.error || `request failed: ${resp.statusCode}`));
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || 'request failed'));
      }
    });
  });
}

function countLocalItems() {
  return DATA_KEYS.reduce((sum, key) => {
    const list = getStorageValue(key, []);
    return sum + (Array.isArray(list) ? list.length : 0);
  }, 0);
}

function suppressAutoSync(fn) {
  suppressDepth += 1;
  try {
    return fn();
  } finally {
    suppressDepth -= 1;
  }
}

function applySnapshotData(data) {
  const normalized = normalizeSnapshotData(data);
  suppressAutoSync(() => {
    for (const key of DATA_KEYS) {
      setStorageValue(key, normalized[key]);
    }
  });
  return normalized;
}

function uploadSnapshot(options) {
  const opt = options || {};
  const reason = opt.reason || 'manual';
  const ignoreAutoGate = !!opt.ignoreAutoGate;
  const cfg = getSyncConfig();

  if (!isSyncConfigValid(cfg)) {
    return Promise.reject(new Error('同步配置不完整'));
  }
  if (!ignoreAutoGate && !cfg.autoSyncEnabled) {
    return Promise.reject(new Error('自动同步未开启'));
  }

  uploadInFlight = true;

  return requestJSON({
    url: `${cfg.baseUrl}/api/v1/snapshot`,
    method: 'PUT',
    data: {
      userId: cfg.userId,
      data: buildSnapshotData()
    }
  })
    .then((resp) => {
      if (!resp || resp.ok !== true) {
        throw new Error((resp && resp.error) || '后端返回异常');
      }
      const successAt = resp.savedAt || new Date().toISOString();
      setLastSuccessAt(successAt);
      setSyncStatus(`同步成功(${reason})：${successAt}`);
      return resp;
    })
    .catch((err) => {
      const message = (err && err.message) || '同步失败';
      setSyncStatus(`同步失败(${reason})：${message}`);
      throw err;
    })
    .finally(() => {
      uploadInFlight = false;
      if (pendingReason) {
        const nextReason = pendingReason;
        pendingReason = '';
        scheduleUpload(nextReason);
      }
    });
}

function scheduleUpload(reason) {
  if (suppressDepth > 0) return;
  const cfg = getSyncConfig();
  if (!cfg.autoSyncEnabled || !isSyncConfigValid(cfg)) return;

  pendingReason = reason || pendingReason || 'change';
  if (uploadInFlight) return;
  if (uploadTimer) return;

  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    const finalReason = pendingReason || 'change';
    pendingReason = '';
    uploadSnapshot({ reason: `auto:${finalReason}` }).catch(() => {});
  }, AUTO_UPLOAD_DELAY_MS);
}

function flushUpload(reason) {
  if (suppressDepth > 0) {
    return Promise.resolve({ skipped: true, reason: 'suspended' });
  }

  const cfg = getSyncConfig();
  if (!cfg.autoSyncEnabled || !isSyncConfigValid(cfg)) {
    return Promise.resolve({ skipped: true, reason: 'config' });
  }

  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
  }

  if (uploadInFlight) {
    pendingReason = reason || pendingReason || 'flush';
    return Promise.resolve({ queued: true });
  }

  return uploadSnapshot({ reason: reason || 'flush' }).catch((err) => ({ ok: false, error: err.message }));
}

function downloadSnapshot(options) {
  const opt = options || {};
  const cfg = {
    ...getSyncConfig(),
    baseUrl: normalizeBaseUrl(opt.baseUrl || getSyncConfig().baseUrl),
    userId: String(opt.userId || getSyncConfig().userId || '').trim()
  };

  if (!isSyncConfigValid(cfg)) {
    return Promise.reject(new Error('同步配置不完整'));
  }

  return requestJSON({
    url: `${cfg.baseUrl}/api/v1/snapshot?userId=${encodeURIComponent(cfg.userId)}`,
    method: 'GET'
  }).then((resp) => {
    if (!resp || resp.ok !== true) {
      throw new Error((resp && resp.error) || '后端返回异常');
    }
    const data = normalizeSnapshotData(resp.data || {});
    return {
      ...resp,
      data
    };
  });
}

function tryInitialPull() {
  if (initialPullTried) {
    return Promise.resolve({ skipped: true, reason: 'already-tried' });
  }
  initialPullTried = true;

  const cfg = getSyncConfig();
  if (!cfg.autoSyncEnabled || !isSyncConfigValid(cfg)) {
    return Promise.resolve({ skipped: true, reason: 'config' });
  }

  if (countLocalItems() > 0) {
    setSyncStatus('检测到本地已有数据，启动时跳过下载');
    return Promise.resolve({ skipped: true, reason: 'local-data-exists' });
  }

  return downloadSnapshot({ baseUrl: cfg.baseUrl, userId: cfg.userId })
    .then((resp) => {
      applySnapshotData(resp.data);
      const ts = resp.fetchedAt || new Date().toISOString();
      setLastSuccessAt(ts);
      setSyncStatus(`启动下载成功：${ts}`);
      return resp;
    })
    .catch((err) => {
      const message = (err && err.message) || '启动下载失败';
      setSyncStatus(`启动下载失败：${message}`);
      return { ok: false, error: message };
    });
}

module.exports = {
  DATA_KEYS,
  DEFAULT_SYNC_BASE_URL,
  DEFAULT_SYNC_USER_ID,
  getSyncConfig,
  saveSyncConfig,
  isSyncConfigValid,
  normalizeBaseUrl,
  isValidBaseUrl,
  isValidUserId,
  normalizeSnapshotData,
  buildSnapshotData,
  getSyncMeta,
  setSyncStatus,
  scheduleUpload,
  flushUpload,
  uploadSnapshot,
  downloadSnapshot,
  applySnapshotData,
  tryInitialPull,
  suppressAutoSync
};
