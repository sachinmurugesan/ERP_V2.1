# Incident Response Plan — HarvestERP

> Owner: Head of Engineering. Reviewed quarterly. Applies to any disruption of
> service, data integrity incident, or security event (suspected breach, DoS,
> credential compromise, data loss).

## 1. Severity matrix

| Level | Definition | Response time | Who to page |
|-------|------------|---------------|-------------|
| **P1 — Critical** | Full outage, data loss, active breach, payment flow broken | 15 min (24/7) | On-call + founders |
| **P2 — High** | Degraded service for ≥25% of users, one portal down | 1 hour (business) | On-call |
| **P3 — Medium** | Isolated bug, no data loss, workaround available | Next business day | Assignee |
| **P4 — Low** | Cosmetic, non-blocking | Next sprint | Backlog |

## 2. First responder checklist (first 30 min)

- [ ] Acknowledge the alert in Grafana / UptimeRobot so it stops paging others.
- [ ] Open an incident channel / thread: `#inc-YYYYMMDD-<slug>`.
- [ ] Capture:
  - When did it start? (grep logs / alert timestamp)
  - What is the user-visible symptom?
  - How many users are affected? (look at access logs)
  - What changed recently? (`git log --since '6 hours ago'`, last deploy time)
- [ ] Decide **mitigate vs. investigate**:
  - Rollback if a recent deploy is suspected: `git checkout <previous-tag> && bash deploy.sh`
  - Toggle feature flag if the bad code path has one.
  - Scale up (more workers / DB) if it's load.
  - Block the offending IP (see §4) if it's an active attack.

## 3. Containment — suspected breach

If there's any evidence of unauthorised access (unexpected admin action, SQL patterns in logs, successful login from suspicious IP):

1. **Rotate secrets immediately**:
   ```bash
   # On the VPS
   cd /opt/harvesterp
   # Generate new secrets and update .env — do NOT commit
   JWT_SECRET=$(openssl rand -base64 32)
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
   docker compose -f docker-compose.prod.yml restart api
   ```
   Rotating `JWT_SECRET` invalidates every outstanding token.

2. **Force logout everyone** (belt + braces, because rotation above already does it):
   ```sql
   -- inside the DB
   INSERT INTO revoked_tokens (id, jti, token_type, expires_at, reason)
   SELECT gen_random_uuid()::text, jti, 'access', now() + interval '30 days', 'incident-force-logout'
     FROM (…);    -- fill in if we later persist issued JTIs
   ```
   (For now the secret rotation is authoritative; this block is reserved for the day we persist issued JTIs.)

3. **Lock the affected account(s)**:
   ```sql
   UPDATE users SET is_active = false WHERE id IN (…);
   ```

4. **Preserve evidence**:
   - `docker logs <container> > /var/backups/incident-<id>/api.log`
   - `cp -a /var/backups/harvesterp /var/backups/incident-<id>/db/`
   - Do **not** delete / truncate the audit_logs table.

5. **Notify** per §7 below.

## 4. Mitigation — DoS / abusive traffic

- Check nginx access logs for the spike: `docker compose logs --tail=1000 nginx | awk '{print $1}' | sort | uniq -c | sort -rn | head`
- Block IPs at ufw: `ufw insert 1 deny from <ip>`
- If distributed: enable Cloudflare proxy (orange cloud) on the DNS entry and enable Under Attack mode.
- Tighten rate-limit zones in `nginx/nginx.conf` and reload.

## 5. Recovery — data loss

If a disk failure or destructive bug corrupts the DB:

1. Stop the API: `docker compose -f docker-compose.prod.yml stop api`
2. Pick the most recent valid backup (see `/var/backups/harvesterp/`).
3. `bash deploy/restore-db.sh /var/backups/harvesterp/harvesterp_YYYYMMDDT…sql.gz.gpg`
4. Verify: `curl https://api.absodok.com/health` and run a spot-check query.
5. Communicate to users the window of lost data (from backup timestamp to incident).

## 6. Post-incident review (within 72 h)

Blameless review using the template in `docs/ops/INCIDENT_TEMPLATE.md`. Output:
- Timeline (UTC) of every relevant event.
- Root cause (technical) and contributing factors (process).
- Action items with owner + due date. File as GitHub issues.
- Update runbook / monitoring / this document with any gaps found.

## 7. External notification

| Audience | When | How |
|----------|------|-----|
| Affected clients | Within 72 h of confirmed breach (Indian IT Act Sec 43A) | Email from grievance officer with scope + steps taken |
| CERT-In | Within 6 h of detecting a cybersecurity incident (CERT-In Directions 2022) | [incident@cert-in.org.in](mailto:incident@cert-in.org.in) |
| Payment partners | If payment data involved | Per partner contract |
| Status page | Any P1 / P2, immediately | https://status.absodok.com (to be set up) |

## 8. Contacts

| Role | Primary | Backup |
|------|---------|--------|
| On-call engineer | _TBD_ | _TBD_ |
| Founder | Sachin Murugesan | _TBD_ |
| Grievance officer | _TBD — required ≥100 users_ | — |
| Hosting (Hostinger) | support@hostinger.com | — |
| Domain registrar | _TBD_ | — |

Keep this list current. Review every quarter.
