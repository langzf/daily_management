# Test Report

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: QA Team
Updated: 2026-04-01

## Execution Summary
| Suite | Related-REQ | Planned | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- | --- |
| SUITE-CORE | REQ-001 | 42 | 40 | 2 | 0 |
| SUITE-DATA | REQ-002 | 30 | 29 | 1 | 0 |

## Defect Summary
| Defect-ID | Related-REQ | Severity | Owner | Status | Retest |
| --- | --- | --- | --- | --- | --- |
| DEF-101 | REQ-001 | P1 | Backend | Fixed | Passed |
| DEF-102 | REQ-002 | P2 | Backend | Fixed | Passed |

## Coverage Summary
- Requirement coverage: 100% for listed scope.
- Critical path coverage: complete.
- Non-functional baseline: acceptable.

## Runtime Evidence
- Execution timestamp: 2026-04-06T18:22:46+0800
- Integration command: make test-integration
- E2E command: make test-e2e
- Non-functional command: make test-nfr
- Logs: artifacts/qa/runtime/
