# Schema Design

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Data Team
Updated: 2026-04-01

## Tables
| Table | Columns | Primary Key | Notes |
| --- | --- | --- | --- |
| order | order_id, user_id, status, created_at | order_id | Core aggregate |
| order_event | event_id, order_id, event_type, event_at | event_id | Event history |

## Index Strategy
| Table | Index | Purpose |
| --- | --- | --- |
| order | idx_order_user_status(user_id,status) | Query active orders by user |
| order_event | idx_event_order_time(order_id,event_at) | Replay state timeline |

## Constraints
- FK: order_event.order_id -> order.order_id
- CHECK: order.status in ('NEW','PAID','FULFILLED','CANCELLED')
