# HarvestERP - Consolidated Code Review Report
**Date:** 2026-03-09
**Reviewers:** 4 parallel agents (Python, Security, Frontend, Database)
**Total Findings:** 96 raw -> 52 deduplicated

## CRITICAL (14 deduplicated)

| # | Issue | Source | Files |
|---|-------|--------|-------|
| C1 | Float for ALL money columns | DB+Sec+Py | models.py |
| C2 | No authentication on ANY endpoint | Security | All routers |
| C3 | N+1 queries in 5 places | DB | orders.py, finance.py |
| C4 | Path traversal in file uploads | Sec+Py | documents.py, shipping.py |
| C5 | Race condition on order number | DB | orders.py:241 |
| C6 | Race condition on credit (TOCTOU) | Security | finance.py:907 |
| C7 | No file type validation | Security | aftersales.py, documents.py |
| C8 | Exception handler leaks internals | Security | main.py:473 |
| C9 | Swallowed exceptions (10+) | Python | excel.py, orders.py |
| C10 | Settings.vue bypasses API client | Frontend | Settings.vue:3 |
| C11 | Module-level migration no error boundary | Python | main.py:256-461 |
| C12 | Wrong type annotations (dict=None) | Python | finance.py:378 |
| C13 | MD5 for image hashing | Python | 5 locations |
| C14 | Duplicate API method (dead code) | Frontend | api/index.js:194 |

## HIGH (20 deduplicated)

| # | Issue | Source |
|---|-------|--------|
| H1 | 14 FK columns missing indexes | DB |
| H2 | Missing cascade rules | DB |
| H3 | Status arrays in 7 files (Lesson #13) | Frontend |
| H4 | stageStyles inconsistent 3 views | Frontend |
| H5 | formatDate duplicated 10+ files | Frontend |
| H6 | 7 files exceed 800-line limit | Frontend |
| H7 | Catch blocks swallow errors | Frontend |
| H8 | DEBUG defaults to true | Security |
| H9 | No rate limiting | Security |
| H10 | No security headers | Security |
| H11 | CORS overly permissive | Security |
| H12 | Content-Disposition injection | Security |
| H13 | 600MB file read into RAM | Security |
| H14 | Credit match on float amount | DB |
| H15 | STAGE_MAP divergent duplicate | DB+Py |
| H16 | 71x deprecated datetime.utcnow | Python |
| H17 | 31x is_active == True | Python |
| H18 | Missing return types ALL endpoints | Python |
| H19 | 14 inline imports in functions | Python |
| H20 | Double-commit payment creation | Python+DB |

## DEAD CODE

- 4 legacy service provider tables (models.py)
- paymentsApi.receivables (api/index.js:194)
- Settings exchange rate filter input (Settings.vue:318)
- OrderList Filter/Export buttons (OrderList.vue:203)
- indianStates duplicated (TransportForm + ClientForm)
- 65 unused imports across codebase

## PRIORITY: Sprint 1 Security, Sprint 2 Financial, Sprint 3 Perf, Sprint 4 Quality
