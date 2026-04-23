"""
Gunicorn configuration for production deployment.
Uses uvicorn workers for ASGI support.
"""
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Worker processes
workers = int(os.getenv("WORKERS", "4"))
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = int(os.getenv("WORKER_TIMEOUT", "60"))
keepalive = 5
graceful_timeout = 30

# Worker recycling (prevents memory leaks)
max_requests = int(os.getenv("MAX_REQUESTS", "1000"))
max_requests_jitter = 100

# Request limits
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Security
forwarded_allow_ips = "*"
proxy_protocol = False
