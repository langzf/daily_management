# Daily Management Mini Program

A personal daily management WeChat Mini Program with four core modules:

- Todo
- Habit Check-in
- Schedule Reminder
- Expense Ledger
- Data Backup/Restore
- Local Reminder Notifications
- Backend Auto Sync (optional)
- Refreshed UI with Alibaba open-source Ant Design icons

## Project Directory (Single Source of Truth)

All code and project delivery documents are kept under:

- `/Users/langzhifa/workspaces/daily_management`

Orchestrator artifacts are synced into:

- `docs/delivery-artifacts/`

## Local Development

1. Open `/Users/langzhifa/workspaces/daily_management` in WeChat DevTools.
2. Confirm AppID in `project.config.json` is `wx906c18e761d86790`.
3. Start backend service for sync features.

## Start Backend Service (SQLite)

```bash
cd /Users/langzhifa/workspaces/daily_management
npm run backend:start
```

- Default URL: `http://127.0.0.1:8787`
- Database: `backend/data/daily_management.sqlite`
- Schema: `backend/db/schema.sql`

## Auto Sync Behavior

- App launch: if local data is empty, try pulling snapshot from backend.
- Local data change: auto upload with debounce.
- App hide: force flush pending upload once.
- Data page keeps a debug mode for manual upload/download buttons.

## Automation Commands

- `make lint`
- `make build`
- `make test-unit`
- `make test-integration`
- `make test-e2e`
- `make test-nfr`
- `make scan-security`
- `make package`
- `make backend-start`
- `make backend-test`
- `make backend-logs`

These commands are designed to be called by the software-delivery-orchestrator pipeline.

## Debug Logs

- Access log: `backend/logs/access.log`
- Error log: `backend/logs/error.log`
- Quick tail: `npm run backend:logs`

## UI Icon Source

- Icon system: Ant Design Icons (Alibaba open-source)
- npm latest checked on 2026-04-15:
  - `@ant-design/icons` `6.1.1`
  - `@ant-design/icons-svg` `4.4.2`
- Local assets path: `assets/ant-icons/`

## Sync Orchestrator Artifacts to This Repo

Run:

- `bash scripts/sync_orchestrator_artifacts.sh`

This syncs stage artifacts from `~/.codex/skills/*/artifacts` into this repository at `docs/delivery-artifacts/`.
