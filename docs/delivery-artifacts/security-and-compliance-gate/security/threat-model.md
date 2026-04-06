# Threat Model

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: Security Team
Updated: 2026-04-01

## Scope and Assets
- Critical assets: order data, payment tokens, audit logs.
- In-scope requirements: REQ-001, REQ-002.

## Trust Boundaries
| Boundary-ID | Source | Destination | AuthN/AuthZ | Notes |
| --- | --- | --- | --- | --- |
| TB-001 | Client App | API Gateway | OIDC + RBAC | External boundary |
| TB-002 | API Service | Data Store | mTLS + IAM role | Internal boundary |

## Threat Scenarios
| Threat-ID | REQ-ID | Category | Severity | Mitigation-Status |
| --- | --- | --- | --- | --- |
| THR-001 | REQ-001 | Spoofing | High | Mitigated |
| THR-002 | REQ-002 | Tampering | Medium | Mitigated |

## Controls and Mitigations
- CTRL-001: token validation and signature pinning.
- CTRL-002: strict schema validation and idempotency key checks.

## Residual Risk
- THR-001 residual risk: Low.
- THR-002 residual risk: Low.
