# Monitoring & Observability — HarvestERP

> Target: detect incidents within 2 minutes, notify on-call, and have enough
> telemetry to diagnose the root cause without shell access.

## Stack at a glance

| Concern | Tool | Where it runs | Free tier? |
|---------|------|---------------|-----------|
| Error reporting (back + front) | Sentry | sentry.io | Yes |
| Uptime probes | UptimeRobot | uptimerobot.com | Yes (5 min interval) |
| Log aggregation | Grafana Loki + Promtail | Self-host on VPS | Yes |
| Metrics | Prometheus + Grafana | Self-host on VPS | Yes |
| Alert routing | Grafana Alerting → email / PagerDuty | Self-host | Yes |

All of these are optional for launch day, but rows 1 and 2 are **must-have** before we onboard paying clients.

---

## 1. Sentry — error reporting

### Backend (FastAPI)

Add to `backend/requirements.txt`:
```
sentry-sdk[fastapi]==2.20.0
```

Wire up in `backend/main.py`, before the `FastAPI()` instance is created:
```python
import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

dsn = os.environ.get("SENTRY_DSN")
if dsn:
    sentry_sdk.init(
        dsn=dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES", "0.1")),
        profiles_sample_rate=0.0,
        environment=os.environ.get("APP_ENV", "production"),
        release=os.environ.get("GIT_SHA", "unknown"),
        send_default_pii=False,  # never ship user emails / bodies
        before_send=lambda evt, hint: None if "/health" in (evt.get("request", {}).get("url") or "") else evt,
    )
```

Secrets: set `SENTRY_DSN` in `.env`; never commit it.

### Frontend (Vue)

```
npm install --save @sentry/vue
```

```js
// main.js
import * as Sentry from '@sentry/vue'
Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
})
```

---

## 2. UptimeRobot — external uptime

Create monitors for:
- `GET https://admin.absodok.com/health` — expect `200 {"status":"ok"}`
- `GET https://api.absodok.com/health`
- `GET https://client.absodok.com/`
- `GET https://factory.absodok.com/`

Alert channels:
- Email: ops@absodok.com
- Optional: SMS / Slack webhook / PagerDuty integration

Interval: 5 min (free tier). Upgrade to 1 min once we have paying customers.

---

## 3. Structured logs → Loki

Add `docker-compose.prod.yml` services:
```yaml
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./ops/promtail-config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
    restart: always

  loki:
    image: grafana/loki:latest
    volumes:
      - loki-data:/loki
    restart: always

  grafana:
    image: grafana/grafana:latest
    ports: ["127.0.0.1:3000:3000"]   # bind to localhost; expose via nginx auth
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "false"
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    restart: always
```

Log format expected from the API: JSON with at least `timestamp`, `level`, `logger`, `message`, `request_id`, `user_id`. Switch `uvicorn`/`gunicorn` to JSON access logs:
```
--access-logformat '{"ts":"%(t)s","level":"access","method":"%(m)s","path":"%(U)s","status":%(s)s,"dur_ms":%(D)s,"ip":"%(h)s","ua":"%(a)s"}'
```

Retention: 14 days local, 90 days if shipped to S3. Anything older must be aggregated and anonymised.

---

## 4. Metrics → Prometheus

Expose Prometheus metrics from FastAPI via `prometheus-fastapi-instrumentator` (pinned in requirements.txt). Scrape endpoint: `/internal/metrics` — **gated behind admin auth** and bound to the internal docker network only (not exposed via nginx).

Key dashboards to build in Grafana:
- API request rate / error rate / latency p50/p95/p99 (RED method)
- Postgres connection pool utilisation, long-running queries
- Auth: login failures / minute, 429 rate-limit rejects / minute
- Upload: bytes uploaded / minute, rejections (size/type)

---

## 5. Alert rules (Grafana → email / PagerDuty)

| Alert | Condition | Severity |
|-------|-----------|----------|
| API 5xx burst | `rate(http_requests_total{status=~"5.."}[5m]) > 1` | P1 |
| API p95 latency | `histogram_quantile(0.95, http_request_duration) > 2s for 10m` | P2 |
| DB disk usage | `pg_disk_usage_bytes > 0.8 * pg_disk_total_bytes` | P1 |
| Login failure spike | `rate(login_failed_total[5m]) > 10` | P2 (possible brute force) |
| Uptime probe fail | 2 consecutive UptimeRobot failures | P1 |
| Backup missing | No new dump in `/var/backups/harvesterp/` in 26 h | P1 |
| TLS cert expiry | `cert_not_after - now < 14d` | P2 |

---

## 6. On-call playbook skeleton

See `docs/ops/INCIDENT_RESPONSE.md` for detail. At a glance:
1. Acknowledge alert within 5 min.
2. Start `#incident-<timestamp>` thread.
3. Assess blast radius — which portals / users affected.
4. Mitigate first, fix second: roll back deploy, disable feature flag, restart unhealthy container, throttle endpoint.
5. Post incident timeline within 24 h; blameless review within 72 h.
