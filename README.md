# Daily Management Mini Program

A personal daily management WeChat Mini Program with four core modules:

- Todo
- Habit Check-in
- Schedule Reminder
- Expense Ledger

## Project Directory (Single Source of Truth)

All code and project delivery documents are kept under:

- `/Users/langzhifa/workspaces/daily_management`

Orchestrator artifacts are synced into:

- `docs/delivery-artifacts/`

## Local Development

1. Open the repository folder in WeChat DevTools.
2. AppID can be replaced in `project.config.json`.
3. Data is stored locally using WeChat storage APIs.

## Automation Commands

- `make lint`
- `make build`
- `make test-unit`
- `make test-integration`
- `make test-e2e`
- `make test-nfr`
- `make scan-security`
- `make package`

These commands are designed to be called by the software-delivery-orchestrator pipeline.

## Sync Orchestrator Artifacts to This Repo

Run:

- `bash scripts/sync_orchestrator_artifacts.sh`

This syncs stage artifacts from `~/.codex/skills/*/artifacts` into this repository at `docs/delivery-artifacts/`.
