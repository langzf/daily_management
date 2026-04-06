'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SCHEMA_PATH = path.join(ROOT_DIR, 'db', 'schema.sql');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'daily_management.sqlite');
const PORT = Number(process.env.PORT || 8787);
const BODY_LIMIT_BYTES = 2 * 1024 * 1024;

const SNAPSHOT_KEYS = ['daily_todos', 'daily_habits', 'daily_schedule', 'daily_finance'];

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSQL);

const statements = {
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

function normalizeUserId(value) {
  const userId = toText(value, 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
    throw new HttpError(400, 'invalid userId: only letters, numbers, _ and - are allowed');
  }
  return userId;
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
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(text);
}

function sendNoContent(res, statusCode) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > BODY_LIMIT_BYTES) {
        reject(new HttpError(413, 'request body too large'));
      }
    });

    req.on('end', () => {
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
    sendJson(res, 200, {
      ok: true,
      service: 'daily-management-backend',
      dbPath: DB_PATH,
      time: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/snapshot' && method === 'GET') {
    const userId = normalizeUserId(url.searchParams.get('userId'));
    sendJson(res, 200, {
      ok: true,
      userId,
      data: loadSnapshot(userId),
      fetchedAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/v1/snapshot' && method === 'PUT') {
    const body = await readJsonBody(req);
    if (!isObject(body)) {
      throw new HttpError(400, 'request body must be an object');
    }
    const userId = normalizeUserId(body.userId);
    const snapshot = normalizeSnapshotData(body.data);
    saveSnapshot(userId, snapshot);
    sendJson(res, 200, {
      ok: true,
      userId,
      counts: {
        daily_todos: snapshot.daily_todos.length,
        daily_habits: snapshot.daily_habits.length,
        daily_schedule: snapshot.daily_schedule.length,
        daily_finance: snapshot.daily_finance.length
      },
      savedAt: new Date().toISOString()
    });
    return;
  }

  throw new HttpError(404, `route not found: ${method} ${url.pathname}`);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : 'unexpected server error';
    sendJson(res, statusCode, {
      ok: false,
      error: message
    });
  });
});

server.listen(PORT, () => {
  console.log(`backend-ready: http://127.0.0.1:${PORT}`);
  console.log(`backend-db: ${DB_PATH}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
