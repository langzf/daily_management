# Sequence Flows

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Backend Team
Updated: 2026-04-01

| Step | Actor | Action | Expected Result | Failure Handling |
| --- | --- | --- | --- | --- |
| S1 | Client | Submit request | Request accepted and validated | Return 4xx on invalid input |
| S2 | Service | Execute transition | State updated and event emitted | Retry transient downstream errors |
| S3 | Service | Persist and respond | Response returned with final state | Return 5xx with correlation id |
