# My Dear Partner local payments and safety service

This folder implements payments, membership and safety modules. It is not the
complete production authentication/profile/chat backend and must not replace
the live service. The complete backend and web source is in
`https://github.com/worexatechnologies-stack/My-dear-partner-project-by-worexa.git`.
Use Python 3.10 or newer for Django 5.2; the Docker image uses Python 3.12.
The previous Python 3.9 virtual environment must be recreated before installing
the upgraded requirements.

For isolated checks without replacing an existing environment:

```sh
python3 -m venv .venv-release  # use Python 3.10 or newer
.venv-release/bin/python -m pip install -r requirements.txt
DJANGO_DEBUG=true .venv-release/bin/python manage.py test safety payments memberships config --noinput
```

Start the Docker service with:

```sh
cp .env.example .env
docker compose up --build
```

Before production, set a strong unique `DJANGO_SECRET_KEY` and real PostgreSQL/Redis/Razorpay values. Set `POSTGRES_PASSWORD` and use the same URL-encoded password in `DATABASE_URL`. Compose refuses to start without the database password, and Django refuses to start in production without a valid secret.

### Database Load Balancing Architecture
The backend uses a two-tier database load balancing architecture:
1. **Tier 1 - Connection Pooler & Load Balancer (`pgbouncer`)**:
   - Manages connection lifecycle and multiplexes application traffic over port `6432`.
   - Runs in transaction pooling mode (`POOL_MODE: transaction`) with connection limits and health checks (`pg_isready`).
   - Prevents connection starvation from concurrent Gunicorn and Celery workers, optimizing throughput.
2. **Tier 2 - Django Primary/Replica Read-Write Split (`DatabaseLoadBalancerRouter`)**:
   - `db_for_write`: Routes all writes (`INSERT`, `UPDATE`, `DELETE`) and migrations strictly to the primary/leader node (`'default'`).
   - `db_for_read`: Load-balances eligible reads across configured replicas. Authentication, sessions, payments, memberships, safety, and reads inside a primary transaction always use the primary to avoid stale authorization or payment state. Uses the primary when no replica is configured. Replica outage detection and automatic failover are not implemented.
   - Configure read replicas via `DATABASE_READ_REPLICA_URL` or comma-separated `DATABASE_REPLICAS_URLS`.

The Compose API and PgBouncer ports bind to localhost. Expose the API through a
trusted HTTPS reverse proxy; remote clients cannot reach these host ports directly.
PgBouncer requires SCRAM password authentication. PostgreSQL URL credentials are
URL-decoded, and server-side cursors are disabled for transaction pooling.
Production session and CSRF cookies require HTTPS. Configure and verify HTTPS
redirects and HSTS at the reverse proxy before release.

Run migrations,
and register `https://mydearpartner.in/api/v1/payments/webhooks/razorpay/` in
Razorpay for `payment.captured`, `payment.failed`, and `order.paid` events.
The webhook secret must equal `RAZORPAY_WEBHOOK_SECRET`. Never expose either
Razorpay secret to the mobile app.

Payment flow is: authenticated member creates order with `membership_plan_id`;
the app opens Razorpay using returned `order_id`, `amount` (paise), and public
`key_id`; client signature verification confirms the hint only; a valid,
idempotent Razorpay webhook atomically activates/extends membership.

Single-device login integration is in [account_sessions/README.md](account_sessions/README.md).
It includes a session-aware token issuer, access/refresh enforcement, targeted FCM
notices and a durable retry outbox. It still requires integration into the full
production backend, all web/OTP issuers, and WebSocket authorization.
