# Context Diagram

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Architecture Team
Updated: 2026-04-01

## External Systems
| System | Interface | Trust Boundary |
| --- | --- | --- |
| Identity Provider | OAuth2/OIDC | External Trusted |
| Notification Service | Async queue | External Partner |

## Data Flows
- Client -> API Gateway -> Orchestrator Service -> Data Service
- Orchestrator Service -> Notification Service (event-driven)

## Failure Domains
- Edge domain: gateway and ingress policy failures
- Core domain: orchestration and business workflow failures
- Data domain: storage and replication failures
