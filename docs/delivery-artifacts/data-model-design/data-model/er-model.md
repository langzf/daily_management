# ER Model

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Data Team
Updated: 2026-04-01

## Entities
| Entity | Key | Description |
| --- | --- | --- |
| order | order_id | Tracks user order lifecycle |
| order_event | event_id | Tracks state transitions |

## Relationships
| Source | Target | Cardinality | Constraint |
| --- | --- | --- | --- |
| order | order_event | 1:N | order_event.order_id must exist |

## Invariants
- order.status must follow allowed state machine.
- order_event.timestamp must be non-decreasing per order.
