# Data Model Mapping

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Data Team
Updated: 2026-04-01

| REQ-ID | Entity/Table | Query Pattern | Control | Coverage-Status |
| --- | --- | --- | --- | --- |
| REQ-001 | order | user active order lookup | idx_order_user_status | Covered |
| REQ-002 | order_event | timeline replay | idx_event_order_time | Covered |
