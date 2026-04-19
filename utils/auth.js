const AUTH_TOKEN_KEY = 'daily_auth_token';
const AUTH_EXPIRES_AT_KEY = 'daily_auth_expires_at';
const AUTH_USER_KEY = 'daily_auth_user';
const AUTH_REFRESH_GAP_MS = 60 * 1000;

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

function removeStorageValue(key) {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.removeStorageSync !== 'function') return;
  wxObj.removeStorageSync(key);
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  return value.replace(/\/+$/, '');
}

function isValidBaseUrl(baseUrl) {
  return /^https?:\/\//.test(String(baseUrl || ''));
}

function getAuthState() {
  const token = String(getStorageValue(AUTH_TOKEN_KEY, '') || '').trim();
  const expiresAt = Number(getStorageValue(AUTH_EXPIRES_AT_KEY, 0) || 0);
  const user = getStorageValue(AUTH_USER_KEY, null);
  return {
    token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    user: user && typeof user === 'object' ? user : null
  };
}

function setAuthState(next) {
  const state = next || {};
  const token = String(state.token || '').trim();
  const expiresAt = Number(state.expiresAt || 0);
  const user = state.user && typeof state.user === 'object' ? state.user : null;

  setStorageValue(AUTH_TOKEN_KEY, token);
  setStorageValue(AUTH_EXPIRES_AT_KEY, expiresAt > 0 ? expiresAt : 0);
  if (user) {
    setStorageValue(AUTH_USER_KEY, user);
  } else {
    removeStorageValue(AUTH_USER_KEY);
  }
}

function clearAuthState() {
  removeStorageValue(AUTH_TOKEN_KEY);
  removeStorageValue(AUTH_EXPIRES_AT_KEY);
  removeStorageValue(AUTH_USER_KEY);
}

function isAuthStateValid(state) {
  const current = state || getAuthState();
  return !!current.token && current.expiresAt > Date.now() + AUTH_REFRESH_GAP_MS;
}

function requestJSON({ url, method, data, headers }) {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.request !== 'function') {
    return Promise.reject(new Error('wx.request is unavailable'));
  }

  return new Promise((resolve, reject) => {
    wxObj.request({
      url,
      method,
      data,
      header: headers || {},
      timeout: 8000,
      success: (resp) => {
        const body = resp.data || {};
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          resolve(body);
          return;
        }
        const err = new Error(body.error || `request failed: ${resp.statusCode}`);
        err.statusCode = resp.statusCode;
        reject(err);
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || 'request failed'));
      }
    });
  });
}

function wxLogin() {
  const wxObj = getWx();
  if (!wxObj || typeof wxObj.login !== 'function') {
    return Promise.reject(new Error('wx.login is unavailable'));
  }

  return new Promise((resolve, reject) => {
    wxObj.login({
      success: (res) => {
        if (!res || !res.code) {
          reject(new Error('wx.login returned empty code'));
          return;
        }
        resolve(res.code);
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || 'wx.login failed'));
      }
    });
  });
}

function parseExpiresAt(value) {
  if (!value) return 0;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : 0;
}

function ensureAuthorized(options) {
  const opt = options || {};
  const baseUrl = normalizeBaseUrl(opt.baseUrl || '');
  const force = !!opt.force;
  if (!isValidBaseUrl(baseUrl)) {
    return Promise.reject(new Error('API地址需以 http/https 开头'));
  }

  const cached = getAuthState();
  if (!force && isAuthStateValid(cached)) {
    return Promise.resolve(cached);
  }

  return wxLogin()
    .then((code) =>
      requestJSON({
        url: `${baseUrl}/api/v1/auth/login`,
        method: 'POST',
        data: {
          code
        }
      })
    )
    .then((resp) => {
      if (!resp || resp.ok !== true || !resp.token) {
        throw new Error((resp && resp.error) || '授权登录失败');
      }
      const nextState = {
        token: String(resp.token || ''),
        expiresAt: parseExpiresAt(resp.expiresAt),
        user: resp.user && typeof resp.user === 'object' ? resp.user : null
      };
      setAuthState(nextState);
      return nextState;
    });
}

function logoutAuthorized(options) {
  const opt = options || {};
  const baseUrl = normalizeBaseUrl(opt.baseUrl || '');
  const current = getAuthState();
  if (!isValidBaseUrl(baseUrl)) {
    clearAuthState();
    return Promise.resolve({ skipped: true, reason: 'invalid-base-url' });
  }
  if (!current.token) {
    clearAuthState();
    return Promise.resolve({ skipped: true, reason: 'not-logged-in' });
  }

  return requestJSON({
    url: `${baseUrl}/api/v1/auth/logout`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${current.token}`
    }
  })
    .catch(() => ({ ok: false }))
    .then((resp) => {
      clearAuthState();
      return resp;
    });
}

module.exports = {
  getAuthState,
  setAuthState,
  clearAuthState,
  isAuthStateValid,
  ensureAuthorized,
  logoutAuthorized
};
