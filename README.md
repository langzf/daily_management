# Daily Management Mini Program

A personal daily management WeChat Mini Program with four core modules:

- Todo
- Habit Check-in
- Schedule Reminder
- Expense Ledger
- Data Backup/Restore
- Local Reminder Notifications
- Backend Sync (optional)

## Project Directory (Single Source of Truth)

All code and project delivery documents are kept under:

- `/Users/langzhifa/workspaces/daily_management`

Orchestrator artifacts are synced into:

- `docs/delivery-artifacts/`

## Local Development

1. Open `/Users/langzhifa/workspaces/daily_management` in WeChat DevTools.
2. Confirm AppID in `project.config.json` is `wx906c18e761d86790`.
3. To use backend sync, start backend service first.

## Start Backend Service (SQLite)

```bash
cd /Users/langzhifa/workspaces/daily_management
npm run backend:start
```

- Default URL: `http://127.0.0.1:8787`
- Database: `backend/data/daily_management.sqlite`
- Schema: `backend/db/schema.sql`

Then in mini program Data page:

1. Fill API URL and userId.
2. Click `上传到后端` or `从后端下载`.

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

These commands are designed to be called by the software-delivery-orchestrator pipeline.

## Sync Orchestrator Artifacts to This Repo

Run:

- `bash scripts/sync_orchestrator_artifacts.sh`

This syncs stage artifacts from `~/.codex/skills/*/artifacts` into this repository at `docs/delivery-artifacts/`.
