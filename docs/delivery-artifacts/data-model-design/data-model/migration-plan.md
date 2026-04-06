# Migration Plan

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Data Team
Updated: 2026-04-01

## Plan
1. Create new tables and indexes.
2. Backfill historical data in batches.
3. Switch read path to new schema.
4. Enable write path and monitor errors.

## Rollback
- Disable write switch flag.
- Revert read path to legacy table.
- Drop new writes after checkpoint.

## Compatibility
- Keep dual-write for one release window.
