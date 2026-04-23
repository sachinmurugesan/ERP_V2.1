# Privacy Policy — HarvestERP

> **Effective date:** [publish date]
> **Controller:** Absodok Pvt. Ltd., [registered address], India
> **Contact:** privacy@absodok.com

This policy explains what personal information HarvestERP collects, how we use
it, and the rights available to users under the Digital Personal Data Protection
Act, 2023 (India) and Section 43A of the IT Act, 2000.

## 1. Scope

HarvestERP is a business-to-business supply-chain ERP. Our customers (importer
clients and their internal users, contracted factories) are the people whose
data we process. End-consumers of the client's products are **not** our users;
we never receive their data directly.

## 2. What we collect

| Category | Data | Source | Purpose |
|----------|------|--------|---------|
| Account | Name, email, password hash, role, tenant | Provided at sign-up by the customer admin | Authenticate and authorise access |
| Business | Company name, GSTIN, addresses | Customer admin | Generate invoices, BOE, shipping docs |
| Operational | Orders, payments, shipping, after-sales records | Generated as users operate the app | Core product functionality |
| Technical | IP address, user-agent, request paths, timestamps | Automatically, from HTTP requests | Security, rate-limiting, incident response |
| Billing | Bank reference, payment proofs | Uploaded by users | Reconcile payments, audit |

We do **not** collect biometric, health, sexual orientation, or political
information. We do not collect data from end-consumers of our customers'
products. We do not use third-party cookies for advertising.

## 3. Lawful basis

- **Contract**: everything in categories "Account" and "Business" is processed
  because it is necessary to deliver the service.
- **Legal obligation**: payment, invoice, and tax data is retained per Indian
  tax and accounting law.
- **Legitimate interest**: technical logs are retained for security and
  troubleshooting, subject to the safeguards in §6.

We do **not** rely on consent as the primary basis, so withdrawing consent is
not an available mechanism — users who do not wish their data to be processed
should stop using the service, and the account holder may request erasure
per §8.

## 4. Sharing

We do not sell data. We disclose it only:
- To sub-processors necessary to operate the service (hosting — Hostinger, email
  — TBD, error reporting — Sentry). Each has a data-processing agreement.
- To law-enforcement when served with a lawful order under Indian law.
- With written permission from the account holder.

Customer data is segregated logically by `client_id` / `factory_id`; a customer
cannot see another customer's data.

## 5. Storage, encryption, and location

- Data at rest: PostgreSQL on a VPS in an Indian data center (Mumbai region).
  Full disk encryption at the hypervisor level; database dumps encrypted with
  GPG before leaving the VPS.
- Data in transit: TLS 1.2 / 1.3 only, with HSTS (1 year, includeSubDomains,
  preload). Modern ciphers only.
- Authentication: passwords hashed with Argon2id (64 MiB memory, 3 iterations).
  JWTs signed with HS256, refresh tokens stored in `httpOnly; secure; samesite=strict`
  cookies.

## 6. Retention

| Category | Retention |
|----------|-----------|
| Account records | Until deletion request, then 30 days for backup rotation |
| Orders, payments, invoices | 8 financial years (Indian Companies Act) |
| Technical logs (access, audit) | 90 days online, 1 year archived |
| Error reports (Sentry) | 30 days |
| Backups | 14 days local, 90 days off-site (encrypted) |

After the retention period, data is securely deleted; backups expire under
retention rotation.

## 7. Security

See `docs/SECURITY_AUDIT_1.md` for the current state of technical controls.
Highlights:
- Role-based access control with row-level tenant isolation
- Account lockout after 5 failed logins (15-minute cool-off)
- Password complexity enforced (≥8 chars, upper + lower + digit)
- Rate limiting on auth, uploads, and sensitive endpoints
- Upload content-type + size validation
- Server-side JWT revocation (JTI list) for logout / incident response
- Dependency scanning (pip-audit + npm audit) on every build; zero known CVEs
  in production at the effective date of this policy.

## 8. Your rights

Under the DPDP Act, account holders may:
- Access their personal data (export provided in JSON / CSV on request)
- Correct inaccurate data (in-app or by written request)
- Erase personal data (in-app "delete account" or written request). Erasure
  does **not** remove data we are legally required to keep (invoices, tax
  records), but those records will be anonymised where technically feasible.
- Withdraw consent where consent is the basis (see §3)
- Nominate a person to exercise these rights in case of death or incapacity
- Lodge a grievance with our Grievance Officer (§10)

We respond within **15 business days**.

## 9. Children

HarvestERP is a business product. We do not knowingly collect data from
anyone under 18. Customer admins are contractually responsible for ensuring
they only create accounts for authorised adult employees.

## 10. Grievance Officer

Per Rule 4 of the 2011 IT Rules and Section 10 of the DPDP Act:

> **[Name]**, Grievance Officer
> Absodok Pvt. Ltd.
> [Address]
> grievance@absodok.com

We acknowledge grievances within 24 hours and resolve them within 15 days.

## 11. Changes

We will notify registered users of material changes to this policy at least
30 days before they take effect, via email and an in-app banner.
