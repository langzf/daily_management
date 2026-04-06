# Daily Management Backend

## Start Service

```bash
cd /Users/langzhifa/workspaces/daily_management
node backend/src/server.js
```

Default URL: `http://127.0.0.1:8787`

## API

- `GET /health`
- `GET /api/v1/snapshot?userId=<user-id>`
- `PUT /api/v1/snapshot`

PUT payload example:

```json
{
  "userId": "demo_user",
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
