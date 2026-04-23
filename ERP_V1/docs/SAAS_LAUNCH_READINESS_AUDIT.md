# SaaS Launch Readiness Audit — HarvestERP

> **Date:** April 2026 (Round 1). **Updated:** 2026-04-17 after security Round 2.
> **Purpose:** Pre-launch corporate readiness assessment for SaaS deployment
> **Standard:** OWASP Top 10 (2025), OWASP API Top 10, SOC 2, ISO 27001, GDPR, Indian IT Act

> **Status (2026-04-17):** Application security is complete (Bandit 0 HIGH/MED,
> pip-audit 0 prod CVEs, npm audit 0 CVEs, 98 tests pass). Infrastructure and
> compliance artefacts exist as drafts in `deploy/` and `docs/ops/` and need
> to be executed on the production VPS.

---

## 1. AUTOMATED SECURITY SCAN RESULTS

### 1.1 Bandit SAST (Static Application Security Testing)

**Tool:** Bandit 1.9.4 | **Lines Scanned:** 18,296 | **Files:** 83 Python files

| Severity | Round 1 | Round 2 (2026-04-17) |
|----------|---------|-----------------------|
| HIGH | 5 | **0** |
| MEDIUM | 1 | **0** |
| LOW | 12 | 157 (accepted) |

**HIGH Findings:**

| # | File | Line | Issue | CWE |
|---|------|------|-------|-----|
| 1 | `services/image_extractor.py` | 175 | MD5 used for hashing (weak) | CWE-327 |
| 2 | `services/image_extractor.py` | 268 | MD5 used for hashing (weak) | CWE-327 |
| 3 | `routers/products.py` | 555 | MD5 used for hashing | CWE-327 |
| 4 | `routers/products.py` | 718 | MD5 used for hashing | CWE-327 |
| 5 | `routers/products.py` | 1665 | MD5 used for hashing | CWE-327 |

**Assessment:** MD5 is used only for image deduplication (not security), so these are LOW risk in practice. Add `usedforsecurity=False` parameter to silence.

**MEDIUM Findings:**

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `routers/orders.py` | 2308 | Binding to all interfaces (0.0.0.0) |

---

### 1.2 pip-audit (Dependency Vulnerability Scan)

**Tool:** pip-audit 2.10.0

| Package | Version | CVE | Fix Version | Severity |
|---------|---------|-----|-------------|----------|
| python-multipart | 0.0.20 | CVE-2026-24486 | 0.0.22 | HIGH |
| python-multipart | 0.0.20 | CVE-2026-40347 | 0.0.26 | HIGH |
| pillow | 11.1.0 | CVE-2026-25990 | 12.1.1 | MEDIUM |
| pillow | 11.1.0 | CVE-2026-40192 | 12.2.0 | MEDIUM |
| starlette | 0.41.3 | CVE-2025-54121 | 0.47.2 | HIGH |
| starlette | 0.41.3 | CVE-2025-62727 | 0.49.1 | HIGH |

**Action Required:** Update `requirements.txt`:
```
python-multipart>=0.0.26
Pillow>=12.2.0
starlette>=0.49.1
```

---

### 1.3 npm audit (Frontend Dependency Scan)

**Tool:** npm audit

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| vite | MODERATE | Path traversal in optimized deps | `npm audit fix` |
| vite | MODERATE | `server.fs.deny` bypass | `npm audit fix` |
| vite | HIGH | Arbitrary file read via WebSocket | `npm audit fix` |
| xlsx | HIGH | Prototype pollution | No fix (consider alternative) |
| xlsx | HIGH | ReDoS vulnerability | No fix (consider alternative) |

**Action Required:** Run `npm audit fix`. Consider replacing `xlsx` with `exceljs` (maintained, no known vulns).

---

## 2. OWASP TOP 10 (2025) ASSESSMENT

| # | Vulnerability | Status | Details |
|---|---------------|--------|---------|
| A01 | Broken Access Control | FIXED (Audit #1) | 6 CRITICAL IDOR issues fixed. All endpoints now have auth + RLS. |
| A02 | Cryptographic Failures | PARTIAL | Argon2 for passwords ✅. JWT secret hardcoded default ⚠️. MD5 for non-security use ⚠️. |
| A03 | Injection | PASS | SQLAlchemy ORM used throughout. No raw SQL with user input. |
| A04 | Insecure Design | PARTIAL | Business logic flaws fixed. Stage engine needs more validation. |
| A05 | Security Misconfiguration | NEEDS WORK | Swagger UI exposed. Debug mode leaks details. CORS is dev-only. |
| A06 | Vulnerable Components | FAIL | 6 known CVEs in Python deps, 5 in npm deps. Must update. |
| A07 | Identity & Auth Failures | PARTIAL | JWT auth works. Tokens in localStorage ⚠️. No token revocation ⚠️. |
| A08 | Software & Data Integrity | PARTIAL | No SRI hashes on CDN scripts. No lock file integrity check. |
| A09 | Logging & Monitoring | PARTIAL | Audit logs exist ✅. No centralized logging. No alerting. |
| A10 | SSRF | PASS | No server-side URL fetching from user input. |

---

## 3. OWASP API SECURITY TOP 10 ASSESSMENT

| # | Vulnerability | Status | Details |
|---|---------------|--------|---------|
| API1 | Broken Object Level Authorization | FIXED | All endpoints now check ownership. |
| API2 | Broken Authentication | PARTIAL | JWT works. Dev bypass exists. No token revocation. |
| API3 | Broken Object Property Level Auth | PARTIAL | Role-based field filtering exists. Some endpoints expose internal fields. |
| API4 | Unrestricted Resource Consumption | NEEDS WORK | Rate limiting only on login. No limits on file uploads, search, excel processing. |
| API5 | Broken Function Level Authorization | FIXED | Admin-only operations now restricted. |
| API6 | Unrestricted Access to Sensitive Flows | PARTIAL | Payment submission requires verification. After-sales resolve now admin-only. |
| API7 | Server Side Request Forgery | PASS | No SSRF vectors found. |
| API8 | Security Misconfiguration | NEEDS WORK | Swagger exposed. No CSP header. CORS too permissive for production. |
| API9 | Improper Inventory Management | PASS | All endpoints documented in Swagger. No shadow APIs. |
| API10 | Unsafe API Consumption | PASS | No third-party API calls with user-controlled data. |

---

## 4. SECURITY HEADERS AUDIT

| Header | Status | Current Value |
|--------|--------|---------------|
| X-Content-Type-Options | ✅ SET | `nosniff` |
| X-Frame-Options | ✅ SET | `DENY` |
| Referrer-Policy | ✅ SET | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ SET | `camera=(), microphone=(), geolocation=()` |
| Content-Security-Policy | ❌ MISSING | Not configured |
| Strict-Transport-Security | ❌ MISSING | Not configured |
| X-XSS-Protection | ❌ MISSING | Deprecated but still useful for older browsers |
| Cache-Control | ❌ MISSING | No cache control on API responses |

---

## 5. AUTHENTICATION & SESSION SECURITY

| Check | Status | Details |
|-------|--------|---------|
| Password hashing | ✅ PASS | Argon2id (via passlib) |
| JWT signing | ⚠️ WARN | Algorithm: HS256. Consider RS256 for multi-service. |
| Token storage | ❌ FAIL | localStorage (XSS-vulnerable). Should be httpOnly cookie. |
| Token expiry | ✅ PASS | Access: 30 min, Refresh: 7 days |
| Token revocation | ❌ FAIL | No server-side revocation. Logout is client-only. |
| Brute force protection | ⚠️ PARTIAL | Login: 5/min rate limit. Refresh: no limit. |
| Account lockout | ❌ MISSING | No lockout after failed attempts. |
| Password policy | ❌ MISSING | No minimum length/complexity enforcement. |
| MFA/2FA | ❌ MISSING | No multi-factor authentication. |
| Session fixation | ✅ PASS | JWT-based, no session cookies to fixate. |

---

## 6. DATA PROTECTION & PRIVACY

| Check | Status | Details |
|-------|--------|---------|
| Data encryption at rest | ❌ FAIL | SQLite file is unencrypted. PostgreSQL: use TDE or disk encryption. |
| Data encryption in transit | ⚠️ PARTIAL | HTTPS not enforced (no HSTS header). Dev uses HTTP. |
| PII identification | ⚠️ PARTIAL | Client names, emails, GSTIN stored. No PII inventory document. |
| Data retention policy | ❌ MISSING | No automated data purge. No retention schedule. |
| Right to erasure | ❌ MISSING | No "delete my data" endpoint. Soft deletes only. |
| Data export (portability) | ❌ MISSING | No user data export feature. |
| Privacy policy | ❌ MISSING | No privacy policy page in the app. |
| Cookie consent | ✅ N/A | No cookies used (JWT in localStorage). If cookies adopted, need consent. |
| Audit trail | ✅ PASS | AuditLog model tracks all mutations with user/timestamp. |
| Backup encryption | ❌ MISSING | No backup strategy documented. |

---

## 7. INFRASTRUCTURE READINESS

| Check | Status | Details |
|-------|--------|---------|
| SSL/TLS certificate | ❌ TODO | Need to configure on Hostinger VPS (Let's Encrypt) |
| DNSSEC | ❌ TODO | Not configured |
| CAA records | ❌ TODO | Not configured |
| Firewall rules | ❌ TODO | Only expose ports 80, 443. Block 8080 externally. |
| DDoS protection | ❌ TODO | Cloudflare or similar needed |
| Database backup | ❌ TODO | Need daily pg_dump cron |
| Log aggregation | ❌ TODO | No centralized logging (ELK/Loki) |
| Monitoring | ❌ TODO | No uptime monitoring (UptimeRobot/Grafana) |
| Alerting | ❌ TODO | No alert on errors/downtime |
| Status page | ❌ TODO | No public status page |

---

## 8. QUALITY ASSURANCE

| Check | Status | Details |
|-------|--------|---------|
| Unit tests | ⚠️ PARTIAL | 43 tests (transparency, RBAC, IDOR, field leakage). Coverage unknown. |
| Integration tests | ⚠️ PARTIAL | Some API endpoint tests exist. Not comprehensive. |
| E2E tests | ❌ MISSING | No Playwright/Cypress tests. |
| Cross-browser testing | ❌ NOT DONE | Not tested on Safari, Firefox, Edge. |
| Mobile responsiveness | ⚠️ PARTIAL | Tailwind responsive classes used. No formal mobile testing. |
| Accessibility (WCAG 2.1) | ❌ NOT DONE | No ARIA labels, no keyboard nav testing, no screen reader testing. |
| Performance testing | ❌ NOT DONE | No load testing (k6/JMeter). |
| Error monitoring | ❌ MISSING | No Sentry/Bugsnag integration. |

---

## 9. COMPLIANCE CHECKLIST

### Indian IT Act & Data Protection

| Requirement | Status | Notes |
|-------------|--------|-------|
| Reasonable security practices (Section 43A) | ⚠️ PARTIAL | Auth exists but gaps remain |
| Privacy policy (Section 43A, Rule 4) | ❌ MISSING | Must publish before launch |
| Data breach notification | ❌ MISSING | No incident response plan |
| Grievance officer designation | ❌ MISSING | Required for >100 users |
| Data localization | ✅ PASS | Data stays on Indian VPS |

### GST Compliance (if billing features added)

| Requirement | Status |
|-------------|--------|
| Tax Invoice generation | ❌ Not built |
| Credit Note generation | ❌ Not built |
| GSTR-1 data export | ❌ Not built |
| HSN code on invoices | ✅ HSN tariff master exists |
| E-Invoice/IRN | ❌ Not built |
| See: `docs/GST_ACCOUNTING_AND_INVOICING_FRAMEWORK.md` | Documented |

---

## 10. OPERATIONAL READINESS

| Item | Status | Priority |
|------|--------|----------|
| Deployment runbook | ❌ MISSING | MUST HAVE |
| Incident response plan | ❌ MISSING | MUST HAVE |
| On-call rotation | ❌ MISSING | NICE TO HAVE |
| SLA definition | ❌ MISSING | MUST HAVE for enterprise clients |
| Customer support channel | ❌ MISSING | MUST HAVE |
| User documentation / Help | ❌ MISSING | MUST HAVE |
| Changelog / Release notes | ❌ MISSING | NICE TO HAVE |
| Feature flags | ❌ MISSING | NICE TO HAVE |
| Blue-green deployment | ❌ MISSING | NICE TO HAVE |
| Database migration strategy | ⚠️ PARTIAL | Alembic configured but manual |

---

## 11. LAUNCH READINESS SCORECARD

| Category | Round 1 | Round 2 (2026-04-17) | Status |
|----------|---------|-----------------------|--------|
| Authentication & Auth | 6/10 | **10/10** | httpOnly refresh cookie, JTI revocation, lockout, password policy |
| Authorization (RBAC/RLS) | 9/10 | **10/10** | All IDOR fixed, customs/finance gated |
| Input Validation | 7/10 | **9/10** | Pydantic bounds on payments, aftersales, uploads |
| Dependency Security | 3/10 | **10/10** | 0 prod CVEs, pinned lockfile with hashes |
| API Security | 6/10 | **9/10** | Rate limiting, CSP/HSTS, Swagger hidden in prod |
| Data Protection | 4/10 | **7/10** | Privacy policy + ToS drafted, encrypted backups scripted; still need: erasure endpoint, data export |
| Infrastructure | 2/10 | **7/10** | nginx SSL config, certbot, ufw, pg_dump cron, restore script — **need to execute on VPS** |
| Testing | 4/10 | **6/10** | 98 tests (up from 43); still need: E2E, load, accessibility |
| Compliance | 3/10 | **7/10** | Privacy policy, ToS, incident response, CERT-In reporting path — need to publish + designate grievance officer |
| Operational | 2/10 | **6/10** | Deployment runbook, monitoring plan, backup/restore scripts — need on-call rotation + status page |
| **Overall** | **4.6/10** | **8.1/10** | **Ready for soft-launch pending VPS execution of §7 and §10 items** |

---

## 12. PRIORITY ACTION PLAN

### Week 1-2: MUST FIX (Security) — **DONE 2026-04-17**
- [x] Update all vulnerable dependencies (pip-audit: 0 prod CVEs)
- [x] Move JWT refresh token to httpOnly cookie (access token remains in memory)
- [x] Remove dev auth bypass for production
- [x] Add CSP + HSTS headers (in nginx config for prod; FastAPI middleware for dev)
- [x] Add rate limiting to all sensitive endpoints
- [x] Add file upload type/size validation
- [x] Disable Swagger UI in production
- [x] Write SSL/TLS config (`nginx/nginx.conf` + `deploy/init-letsencrypt.sh`)
- [x] Write database backup script (`deploy/backup-db.sh`, cron snippet in runbook)

### Week 3-4: MUST HAVE (Infrastructure) — **SCRIPTED, pending VPS execution**
- [ ] Deploy to PostgreSQL on VPS *(run `bash deploy.sh` and `bash deploy/init-letsencrypt.sh`)*
- [x] Firewall setup script (`deploy/firewall-setup.sh`)
- [ ] Cloudflare DDoS protection *(add DNS + enable orange-cloud after launch)*
- [x] Error monitoring plan (see `docs/ops/MONITORING.md` §1 — Sentry)
- [x] Uptime monitoring plan (UptimeRobot, §2)
- [x] Deployment runbook (`docs/ops/DEPLOYMENT_RUNBOOK.md`)
- [x] Incident response plan (`docs/ops/INCIDENT_RESPONSE.md`)

### Week 5-6: SHOULD HAVE (Compliance) — **DRAFTED, pending legal review**
- [x] Privacy policy (`docs/ops/PRIVACY_POLICY.md` — DPDP Act + IT Act ready)
- [x] Terms of service (`docs/ops/TERMS_OF_SERVICE.md`)
- [x] Password complexity requirements (8 chars, upper+lower+digit)
- [x] Account lockout after failed logins (5 attempts / 15 min)
- [ ] User documentation *(in progress — separate milestone)*
- [ ] SLA definition *(99.5% monthly uptime target set in ToS §7)*
- [ ] Customer support channel *(set up support@absodok.com mailbox + inbound ticketing)*

### Week 7-8: NICE TO HAVE (Quality)
- [ ] E2E tests (Playwright) — plan: login, create order, submit payment, view aftersales
- [ ] Load testing (k6) — target: 100 concurrent users, p95 < 2s
- [ ] Accessibility audit (axe / Lighthouse) — target: WCAG 2.1 AA
- [ ] Cross-browser testing (BrowserStack or manual on Safari/Firefox/Edge)
- [ ] Feature flags (lightweight: env var driven, e.g. `FEATURE_X=true`)
- [ ] CI/CD pipeline (GitHub Actions — run pytest + bandit + pip-audit + npm audit on every PR)
- [ ] PentAGI live pentest on staging VPS

---

## 13. TOOLS RECOMMENDED

| Purpose | Tool | Cost |
|---------|------|------|
| SAST (Python) | Bandit | Free |
| SAST (JS) | ESLint Security Plugin | Free |
| Dependency Scan | pip-audit, npm audit | Free |
| DAST (Live Testing) | PentAGI, OWASP ZAP | Free |
| Error Monitoring | Sentry | Free tier |
| Uptime Monitoring | UptimeRobot | Free tier |
| SSL Certificate | Let's Encrypt | Free |
| DDoS Protection | Cloudflare | Free tier |
| Log Aggregation | Grafana Loki | Free |
| Load Testing | k6 | Free |
| Accessibility | axe-core, Lighthouse | Free |
| Penetration Testing | PentAGI (pentagi.com) | Free (open source) |

---

## Appendices

- **Audit #1 Details:** `docs/SECURITY_AUDIT_1.md`
- **GST Framework:** `docs/GST_ACCOUNTING_AND_INVOICING_FRAMEWORK.md`
- **Architecture Gap Analysis:** `docs/INDUSTRIAL_ARCHITECTURE_GAP_ANALYSIS.md`
