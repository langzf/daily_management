# Daily Management Backend

## Start Service

```bash
cd /Users/langzhifa/workspaces/daily_management
node backend/src/server.js
```

Default URL: `http://127.0.0.1:8787`

Auth mode:

- Production WeChat auth (default): set `WECHAT_APP_ID` and `WECHAT_APP_SECRET`
- Local integration test bypass: set `AUTH_BYPASS=1`

## API

- `GET /health`
- `POST /api/v1/auth/login` (body: `{ "code": "wx.login.code" }`)
- `GET /api/v1/auth/me` (header: `Authorization: Bearer <token>`)
- `POST /api/v1/auth/logout` (header: `Authorization: Bearer <token>`)
- `GET /api/v1/snapshot` (header: `Authorization: Bearer <token>`)
- `PUT /api/v1/snapshot` (header: `Authorization: Bearer <token>`)

PUT payload example:

```json
{
  "data": {
    "daily_todos": [],
    "daily_habits": [],
    "daily_schedule": [],
    "daily_finance": []
  }
}
```

## Database

- Engine: SQLite
- DB path (default): `backend/data/daily_management.sqlite`
- Schema file: `backend/db/schema.sql`
- Auth tables: `users`, `user_sessions`

## Logs

- Access log: `backend/logs/access.log`
- Error log: `backend/logs/error.log`
- Every response carries `x-request-id`; the same ID appears in logs.

Tail access log:

```bash
cd /Users/langzhifa/workspaces/daily_management
npm run backend:logs
```
