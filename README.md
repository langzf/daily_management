# Daily Management Mini Program

A personal daily management WeChat Mini Program with four core modules:

- Todo
- Habit Check-in
- Schedule Reminder
- Expense Ledger

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
