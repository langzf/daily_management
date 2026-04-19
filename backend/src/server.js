'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const SCHEMA_PATH = path.join(ROOT_DIR, 'db', 'schema.sql');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'daily_management.sqlite');
const ACCESS_LOG_PATH = process.env.ACCESS_LOG_PATH || path.join(LOG_DIR, 'access.log');
const ERROR_LOG_PATH = process.env.ERROR_LOG_PATH || path.join(LOG_DIR, 'error.log');
const PORT = Number(process.env.PORT || 8787);
const BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_SECONDS = Math.max(3600, Number(process.env.SESSION_TTL_SECONDS || 30 * 24 * 3600));
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const AUTH_BYPASS = process.env.AUTH_BYPASS === '1';
const WECHAT_APP_ID = String(process.env.WECHAT_APP_ID || '').trim();
const WECHAT_APP_SECRET = String(process.env.WECHAT_APP_SECRET || '').trim();

const SNAPSHOT_KEYS = ['daily_todos', 'daily_habits', 'daily_schedule', 'daily_finance'];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSQL);

const statements = {
  selectUserByOpenid: db.prepare(
    'SELECT user_id, openid, unionid, nickname, avatar_url, created_at, updated_at, last_login_at FROM users WHERE openid = ?'
  ),
  selectUserById: db.prepare(
    'SELECT user_id, openid, unionid, nickname, avatar_url, created_at, updated_at, last_login_at FROM users WHERE user_id = ?'
  ),
  insertUser: db.prepare(
    'INSERT INTO users (user_id, openid, unionid, nickname, avatar_url, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateUserAuthProfile: db.prepare(
    'UPDATE users SET unionid = ?, nickname = ?, avatar_url = ?, last_login_at = ?, updated_at = ? WHERE user_id = ?'
  ),
  insertSession: db.prepare(
    'INSERT INTO user_sessions (session_id, user_id, token_hash, expires_at, revoked, created_at, last_seen_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
  ),
  revokeSessionByTokenHash: db.prepare('UPDATE user_sessions SET revoked = 1 WHERE token_hash = ?'),
  revokeSessionsByUser: db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0'),
  updateSessionLastSeen: db.prepare('UPDATE user_sessions SET last_seen_at = ? WHERE session_id = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM user_sessions WHERE expires_at <= ? OR revoked = 1'),
  selectSessionByTokenHash: db.prepare(
    [
      'SELECT s.session_id, s.user_id, s.token_hash, s.expires_at, s.revoked, s.created_at, s.last_seen_at,',
      'u.openid, u.unionid, u.nickname, u.avatar_url',
      'FROM user_sessions s JOIN users u ON u.user_id = s.user_id',
      'WHERE s.token_hash = ? LIMIT 1'
    ].join(' ')
  ),

  deleteTodos: db.prepare('DELETE FROM todos WHERE user_id = ?'),
  deleteHabits: db.prepare('DELETE FROM habits WHERE user_id = ?'),
  deleteSchedules: db.prepare('DELETE FROM schedules WHERE user_id = ?'),
  deleteFinance: db.prepare('DELETE FROM finance_records WHERE user_id = ?'),

  insertTodo: db.prepare(
    'INSERT INTO todos (user_id, id, text, done, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  insertHabit: db.prepare(
    'INSERT INTO habits (user_id, id, name, streak, checked_today, last_check_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  insertSchedule: db.prepare(
    'INSERT INTO schedules (user_id, id, title, date_text, time_text, timestamp, tag, done, remind_enabled, remind_before_min, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  insertFinance: db.prepare(
    'INSERT INTO finance_records (user_id, id, note, amount, type, category, date_text, month_key, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),

  selectTodos: db.prepare(
    'SELECT id, text, done, priority, created_at, updated_at FROM todos WHERE user_id = ? ORDER BY created_at DESC'
  ),
  selectHabits: db.prepare(
    'SELECT id, name, streak, checked_today, last_check_date, created_at, updated_at FROM habits WHERE user_id = ? ORDER BY created_at DESC'
  ),
  selectSchedules: db.prepare(
    'SELECT id, title, date_text, time_text, timestamp, tag, done, remind_enabled, remind_before_min, created_at, updated_at FROM schedules WHERE user_id = ? ORDER BY created_at DESC'
  ),
  selectFinance: db.prepare(
    'SELECT id, note, amount, type, category, date_text, month_key, timestamp, created_at FROM finance_records WHERE user_id = ? ORDER BY created_at DESC'
  )
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function createRequestId() {
  return crypto.randomUUID();
}

function createUserId() {
  return `u_${crypto.randomBytes(12).toString('hex')}`;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function appendLog(filePath, event) {
  try {
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown log write error';
    console.error(`[log-write-failed] ${filePath} ${message}`);
  }
}

function logAccess(event) {
  const line = {
    ts: new Date().toISOString(),
    level: 'info',
    event: 'access',
    ...event
  };
  console.log(`[access] ${JSON.stringify(line)}`);
  appendLog(ACCESS_LOG_PATH, line);
}

function logError(event) {
  const line = {
    ts: new Date().toISOString(),
    level: 'error',
    event: 'request_error',
    ...event
  };
  console.error(`[error] ${JSON.stringify(line)}`);
  appendLog(ERROR_LOG_PATH, line);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function toText(value, maxLen) {
  const text = String(value == null ? '' : value).trim();
  return maxLen && text.length > maxLen ? text.slice(0, maxLen) : text;
}

function toInteger(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Number(n.toFixed(2));
}

function toBoolInt(value) {
  return value ? 1 : 0;
}

function formatMonth(dateText, timestamp) {
  const text = toText(dateText, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text.slice(0, 7);
  }
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString().slice(0, 7);
  }
  return new Date().toISOString().slice(0, 7);
}

function normalizeLoginCode(value) {
  const code = toText(value, 256);
  if (!code || /\s/.test(code)) {
    throw new HttpError(400, 'invalid login code');
  }
  return code;
}

function sanitizeProfile(profile) {
  if (!isObject(profile)) {
    return {
      nickname: '',
      avatarUrl: ''
    };
  }
  return {
    nickname: toText(profile.nickName || profile.nickname, 80),
    avatarUrl: toText(profile.avatarUrl || profile.avatarURL, 512)
  };
}

function toClientUser(userRow) {
  if (!userRow) return null;
  return {
    userId: userRow.user_id,
    openId: userRow.openid,
    nickname: userRow.nickname || '',
    avatarUrl: userRow.avatar_url || ''
  };
}

function cleanupSessions(nowTs) {
  const now = Number(nowTs || Date.now());
  statements.deleteExpiredSessions.run(now);
}

function createOrRefreshSession(userId, nowTs) {
  const now = Number(nowTs || Date.now());
  const token = createSessionToken();
  const tokenHash = sha256(token);
  const expiresAt = now + SESSION_TTL_MS;
  const sessionId = `s_${crypto.randomUUID()}`;
  statements.revokeSessionsByUser.run(userId);
  statements.insertSession.run(sessionId, userId, tokenHash, expiresAt, now, now);
  return {
    token,
    tokenHash,
    expiresAt
  };
}

function upsertUserAndIssueSession(wxSession, profile) {
  const now = Date.now();
  const openid = toText(wxSession && wxSession.openid, 128);
  const unionid = toText(wxSession && wxSession.unionid, 128);
  if (!openid) {
    throw new HttpError(401, 'missing openid from wechat');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    let user = statements.selectUserByOpenid.get(openid);
    if (!user) {
      const userId = createUserId();
      statements.insertUser.run(
        userId,
        openid,
        unionid,
        profile.nickname || '',
        profile.avatarUrl || '',
        now,
        now,
        now
      );
      user = statements.selectUserById.get(userId);
    } else {
      statements.updateUserAuthProfile.run(
        unionid || user.unionid || '',
        profile.nickname || user.nickname || '',
        profile.avatarUrl || user.avatar_url || '',
        now,
        now,
        user.user_id
      );
      user = statements.selectUserById.get(user.user_id);
    }

    cleanupSessions(now);
    const session = createOrRefreshSession(user.user_id, now);
    db.exec('COMMIT');

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toClientUser(user)
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function exchangeCodeByBypass(code) {
  const normalized = normalizeLoginCode(code);
  return {
    openid: `test_openid_${normalized}`,
    unionid: ''
  };
}

function exchangeCodeByWechat(code) {
  if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
    throw new HttpError(500, 'wechat app credentials are not configured');
  }

  const apiUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  apiUrl.searchParams.set('appid', WECHAT_APP_ID);
  apiUrl.searchParams.set('secret', WECHAT_APP_SECRET);
  apiUrl.searchParams.set('js_code', code);
  apiUrl.searchParams.set('grant_type', 'authorization_code');

  return new Promise((resolve, reject) => {
    let finished = false;
    function done(err, value) {
      if (finished) return;
      finished = true;
      if (err) reject(err);
      else resolve(value);
    }

    const req = https.get(apiUrl, (resp) => {
      let raw = '';
      resp.on('data', (chunk) => {
        raw += chunk;
        if (Buffer.byteLength(raw) > BODY_LIMIT_BYTES) {
          req.destroy(new Error('wechat response too large'));
        }
      });
      resp.on('end', () => {
        if (resp.statusCode < 200 || resp.statusCode >= 300) {
          done(new HttpError(502, `wechat api http status ${resp.statusCode}`));
          return;
        }
        let body;
        try {
          body = JSON.parse(raw || '{}');
        } catch (err) {
          done(new HttpError(502, 'wechat api returned invalid json'));
          return;
        }

        const errcode = Number(body.errcode || 0);
        if (errcode !== 0) {
          done(new HttpError(401, `wechat login failed: ${body.errmsg || errcode}`));
          return;
        }
        if (!body.openid) {
          done(new HttpError(502, 'wechat login failed: openid missing'));
          return;
        }

        done(null, {
          openid: toText(body.openid, 128),
          unionid: toText(body.unionid, 128)
        });
      });
      resp.on('error', (err) => {
        done(new HttpError(502, `wechat response error: ${err.message}`));
      });
    });

    req.setTimeout(7000, () => {
      req.destroy(new Error('wechat api timeout'));
    });
    req.on('error', (err) => {
      done(new HttpError(502, `wechat request error: ${err.message}`));
    });
  });
}

function exchangeCodeForSession(code) {
  const normalized = normalizeLoginCode(code);
  if (AUTH_BYPASS) {
    return Promise.resolve(exchangeCodeByBypass(normalized));
  }
  return exchangeCodeByWechat(normalized);
}

function extractBearerToken(authorizationValue) {
  const raw = toText(authorizationValue, 2048);
  if (!raw) return '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return '';
  return toText(match[1], 2048);
}

function requireAuth(req) {
  cleanupSessions(Date.now());
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new HttpError(401, 'missing bearer token');
  }

  const tokenHash = sha256(token);
  const session = statements.selectSessionByTokenHash.get(tokenHash);
  if (!session || session.revoked === 1) {
    throw new HttpError(401, 'invalid session');
  }

  const now = Date.now();
  if (session.expires_at <= now) {
    statements.revokeSessionByTokenHash.run(tokenHash);
    throw new HttpError(401, 'session expired');
  }

  if (now - Number(session.last_seen_at || 0) > 60 * 1000) {
    statements.updateSessionLastSeen.run(now, session.session_id);
  }

  req.authTokenHash = tokenHash;
  req.authSessionId = session.session_id;
  req.logUserId = session.user_id;
  req.authUser = toClientUser(session);
  req.authExpiresAt = session.expires_at;

  return {
    user: req.authUser,
    sessionId: req.authSessionId,
    expiresAt: req.authExpiresAt
  };
}

function normalizeSnapshotData(data) {
  if (!isObject(data)) {
    throw new HttpError(400, 'data must be an object');
  }
  for (const key of SNAPSHOT_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new HttpError(400, `data.${key} must be an array`);
    }
  }

  const now = Date.now();

  const todos = data.daily_todos
    .map((item) => ({
      id: toText(item && item.id, 128),
      text: toText(item && item.text, 100),
      done: toBoolInt(item && item.done),
      priority: ['low', 'medium', 'high'].includes(item && item.priority) ? item.priority : 'medium',
      createdAt: toInteger(item && item.createdAt, now),
      updatedAt: toInteger(item && item.updatedAt, now)
    }))
    .filter((item) => item.id && item.text);

  const habits = data.daily_habits
    .map((item) => ({
      id: toText(item && item.id, 128),
      name: toText(item && item.name, 80),
      streak: Math.max(0, toInteger(item && item.streak, 0)),
      checkedToday: toBoolInt(item && item.checkedToday),
      lastCheckDate: toText(item && item.lastCheckDate, 16),
      createdAt: toInteger(item && item.createdAt, now),
      updatedAt: toInteger(item && item.updatedAt, now)
    }))
    .filter((item) => item.id && item.name);

  const schedules = data.daily_schedule
    .map((item) => {
      const timestamp = toInteger(item && item.timestamp, NaN);
      return {
        id: toText(item && item.id, 128),
        title: toText(item && item.title, 100),
        dateText: toText(item && item.dateText, 16),
        timeText: toText(item && item.timeText, 16),
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        tag: toText(item && item.tag, 30),
        done: toBoolInt(item && item.done),
        remindEnabled: toBoolInt(item && item.remindEnabled !== false),
        remindBeforeMin: Math.max(0, toInteger(item && item.remindBeforeMin, 15)),
        createdAt: toInteger(item && item.createdAt, now),
        updatedAt: toInteger(item && item.updatedAt, now)
      };
    })
    .filter((item) => item.id && item.title);

  const finance = data.daily_finance
    .map((item) => {
      const timestamp = toInteger(item && item.timestamp, NaN);
      const dateText = toText(item && item.dateText, 16);
      return {
        id: toText(item && item.id, 128),
        note: toText(item && item.note, 100),
        amount: Math.max(0, toNumber(item && item.amount, 0)),
        type: item && item.type === 'income' ? 'income' : 'expense',
        category: toText(item && item.category, 30),
        dateText,
        monthKey: toText(item && item.monthKey, 7) || formatMonth(dateText, timestamp),
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        createdAt: toInteger(item && item.createdAt, now)
      };
    })
    .filter((item) => item.id && item.note && item.amount > 0);

  return {
    daily_todos: todos,
    daily_habits: habits,
    daily_schedule: schedules,
    daily_finance: finance
  };
}

function saveSnapshot(userId, snapshot) {
  db.exec('BEGIN IMMEDIATE');
  try {
    statements.deleteTodos.run(userId);
    statements.deleteHabits.run(userId);
    statements.deleteSchedules.run(userId);
    statements.deleteFinance.run(userId);

    for (const item of snapshot.daily_todos) {
      statements.insertTodo.run(userId, item.id, item.text, item.done, item.priority, item.createdAt, item.updatedAt);
    }
    for (const item of snapshot.daily_habits) {
      statements.insertHabit.run(
        userId,
        item.id,
        item.name,
        item.streak,
        item.checkedToday,
        item.lastCheckDate,
        item.createdAt,
        item.updatedAt
      );
    }
    for (const item of snapshot.daily_schedule) {
      statements.insertSchedule.run(
        userId,
        item.id,
        item.title,
        item.dateText,
        item.timeText,
        item.timestamp,
        item.tag,
        item.done,
        item.remindEnabled,
        item.remindBeforeMin,
        item.createdAt,
        item.updatedAt
      );
    }
    for (const item of snapshot.daily_finance) {
      statements.insertFinance.run(
        userId,
        item.id,
        item.note,
        item.amount,
        item.type,
        item.category,
        item.dateText,
        item.monthKey,
        item.timestamp,
        item.createdAt
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function loadSnapshot(userId) {
  return {
    daily_todos: statements.selectTodos.all(userId).map((item) => ({
      id: item.id,
      text: item.text,
      done: item.done === 1,
      priority: item.priority,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })),
    daily_habits: statements.selectHabits.all(userId).map((item) => ({
      id: item.id,
      name: item.name,
      streak: item.streak,
      checkedToday: item.checked_today === 1,
      lastCheckDate: item.last_check_date,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })),
    daily_schedule: statements.selectSchedules.all(userId).map((item) => ({
      id: item.id,
      title: item.title,
      dateText: item.date_text,
      timeText: item.time_text,
      timestamp: item.timestamp,
      tag: item.tag,
      done: item.done === 1,
      remindEnabled: item.remind_enabled === 1,
      remindBeforeMin: item.remind_before_min,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })),
    daily_finance: statements.selectFinance.all(userId).map((item) => ({
      id: item.id,
      note: item.note,
      amount: Number(item.amount),
      type: item.type,
      category: item.category,
      dateText: item.date_text,
      monthKey: item.month_key,
      timestamp: item.timestamp,
      createdAt: item.created_at
    }))
  };
}

function sendJson(res, statusCode, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id'
  });
  res.end(text);
}

function sendNoContent(res, statusCode) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id'
  });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let ended = false;

    req.on('data', (chunk) => {
      if (ended) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > BODY_LIMIT_BYTES) {
        ended = true;
        reject(new HttpError(413, 'request body too large'));
      }
    });

    req.on('end', () => {
      if (ended) return;
      if (!raw) {
        reject(new HttpError(400, 'request body is empty'));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new HttpError(400, 'invalid JSON body'));
      }
    });

    req.on('error', (err) => {
      reject(new HttpError(500, err.message));
    });
  });
}

async function handleRequest(req, res) {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', 'http://localhost');

  if (method === 'OPTIONS') {
    sendNoContent(res, 204);
    return;
  }

  if (method === 'GET' && url.pathname === '/health') {
    req.logRoute = 'health';
    sendJson(res, 200, {
      ok: true,
      service: 'daily-management-backend',
      dbPath: DB_PATH,
      authBypass: AUTH_BYPASS,
      sessionTtlSeconds: SESSION_TTL_SECONDS,
      time: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/auth/login' && method === 'POST') {
    req.logRoute = 'auth:login';
    const body = await readJsonBody(req);
    if (!isObject(body)) {
      throw new HttpError(400, 'request body must be an object');
    }
    const code = normalizeLoginCode(body.code);
    const profile = sanitizeProfile(body.profile);
    const wxSession = await exchangeCodeForSession(code);
    const result = upsertUserAndIssueSession(wxSession, profile);
    req.logUserId = result.user.userId;
    sendJson(res, 200, {
      ok: true,
      authMode: AUTH_BYPASS ? 'bypass' : 'wechat',
      tokenType: 'Bearer',
      token: result.token,
      expiresAt: new Date(result.expiresAt).toISOString(),
      user: result.user
    });
    return;
  }

  if (url.pathname === '/api/v1/auth/me' && method === 'GET') {
    req.logRoute = 'auth:me';
    const auth = requireAuth(req);
    sendJson(res, 200, {
      ok: true,
      user: auth.user,
      expiresAt: new Date(auth.expiresAt).toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/auth/logout' && method === 'POST') {
    req.logRoute = 'auth:logout';
    requireAuth(req);
    statements.revokeSessionByTokenHash.run(req.authTokenHash);
    sendJson(res, 200, {
      ok: true,
      loggedOutAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/snapshot' && method === 'GET') {
    req.logRoute = 'snapshot:get';
    const auth = requireAuth(req);
    sendJson(res, 200, {
      ok: true,
      userId: auth.user.userId,
      data: loadSnapshot(auth.user.userId),
      fetchedAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/snapshot' && method === 'PUT') {
    req.logRoute = 'snapshot:put';
    const auth = requireAuth(req);
    const body = await readJsonBody(req);
    if (!isObject(body)) {
      throw new HttpError(400, 'request body must be an object');
    }
    const payloadData = isObject(body.data) ? body.data : body;
    const snapshot = normalizeSnapshotData(payloadData);
    req.logSnapshotCounts = {
      daily_todos: snapshot.daily_todos.length,
      daily_habits: snapshot.daily_habits.length,
      daily_schedule: snapshot.daily_schedule.length,
      daily_finance: snapshot.daily_finance.length
    };
    saveSnapshot(auth.user.userId, snapshot);
    sendJson(res, 200, {
      ok: true,
      userId: auth.user.userId,
      counts: req.logSnapshotCounts,
      savedAt: new Date().toISOString()
    });
    return;
  }

  throw new HttpError(404, `route not found: ${method} ${url.pathname}`);
}

const server = http.createServer((req, res) => {
  const startedAt = process.hrtime.bigint();
  const requestId = String(req.headers['x-request-id'] || createRequestId());
  const rawPath = new URL(req.url || '/', 'http://localhost').pathname;

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  let finalized = false;
  function finalizeLog(kind) {
    if (finalized) return;
    finalized = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logAccess({
      requestId,
      route: req.logRoute || 'unknown',
      method: req.method || 'GET',
      path: rawPath,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.logUserId || '',
      snapshotCounts: req.logSnapshotCounts || null,
      kind
    });
  }

  res.on('finish', () => finalizeLog('finish'));
  res.on('close', () => {
    if (!res.writableEnded) {
      finalizeLog('close');
    }
  });

  handleRequest(req, res).catch((err) => {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : 'unexpected server error';
    logError({
      requestId,
      route: req.logRoute || 'unknown',
      method: req.method || 'GET',
      path: rawPath,
      statusCode,
      userId: req.logUserId || '',
      error: message
    });
    sendJson(res, statusCode, {
      ok: false,
      error: message
    });
  });
});

server.listen(PORT, () => {
  console.log(`backend-ready: http://127.0.0.1:${PORT}`);
  console.log(`backend-db: ${DB_PATH}`);
  console.log(`backend-access-log: ${ACCESS_LOG_PATH}`);
  console.log(`backend-error-log: ${ERROR_LOG_PATH}`);
  console.log(`auth-mode: ${AUTH_BYPASS ? 'bypass' : 'wechat'}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
