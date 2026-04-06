# Development Standards

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Engineering Excellence
Updated: 2026-04-01

## Coding Standards
- Enforce language-specific lint and formatter.
- Require explicit error handling and logging context.

## Branch and Merge Policy
- Use short-lived feature branches.
- Require at least one approved review before merge.

## Testing Standards
- Unit tests required for business logic changes.
- Integration tests required for boundary and contract changes.

## CI Quality Gates
- Block merge on failed lint/test/security checks.
- Require deterministic build pipeline pass.

## Definition of Done
- Code merged and deployed to target environment.
- Observability and documentation updated.
