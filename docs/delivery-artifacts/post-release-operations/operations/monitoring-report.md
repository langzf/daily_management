# Monitoring Report

Traceability IDs: REQ-001, REQ-002
Status: draft
Owner: SRE Team
Updated: 2026-04-01

## SLO Snapshot
| Metric | Target | Current | Status |
| --- | --- | --- | --- |
| API Availability | 99.9% | 99.95% | Healthy |
| API Latency P95 | <= 250ms | 220ms | Healthy |

## Alert Summary
| Alert-ID | Related-REQ | Severity | Count | Status |
| --- | --- | --- | --- | --- |
| ALT-001 | REQ-001 | P2 | 3 | Stabilized |
| ALT-002 | REQ-002 | P3 | 2 | Monitoring |

## Capacity and Error Trends
- CPU and memory within safe range.
- Error budget consumption below weekly threshold.
