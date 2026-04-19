PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  openid TEXT NOT NULL UNIQUE,
  unionid TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expire ON user_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS todos (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_todos_user_created ON todos(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS habits (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  checked_today INTEGER NOT NULL DEFAULT 0,
  last_check_date TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_habits_user_created ON habits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS schedules (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  date_text TEXT NOT NULL DEFAULT '',
  time_text TEXT NOT NULL DEFAULT '',
  timestamp INTEGER,
  tag TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  remind_enabled INTEGER NOT NULL DEFAULT 1,
  remind_before_min INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_schedules_user_time ON schedules(user_id, timestamp);

CREATE TABLE IF NOT EXISTS finance_records (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  note TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  date_text TEXT NOT NULL,
  month_key TEXT NOT NULL,
  timestamp INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_finance_user_created ON finance_records(user_id, created_at DESC);
