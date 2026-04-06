# Error Code Specification

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: API Team
Updated: 2026-04-01

## Error Model
- HTTP status aligned with domain error category.
- Error response includes code, message, and correlationId fields.

## Error Codes
| Code | HTTP | Description | Client Action |
| --- | --- | --- | --- |
| ORDER_INVALID_INPUT | 400 | Invalid order payload | Fix request and retry |
| ORDER_NOT_FOUND | 404 | Order does not exist | Verify order id |
| ORDER_CONFLICT | 409 | Duplicate request or state conflict | Retry with idempotency key |
