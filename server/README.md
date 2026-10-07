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

Before production, set a strong unique `DJANGO_SECRET_KEY` and real PostgreSQL/Redis/Razorpay values. Set `POSTGRES_PASSWORD` and use the same URL-encoded password in `DATABASE_URL`. Compose refuses to start without the database password, and Django refuses to start in production without a valid secret. Run migrations,
and register `https://mydearpartner.in/api/v1/payments/webhooks/razorpay/` in
Razorpay for `payment.captured`, `payment.failed`, and `order.paid` events.
The webhook secret must equal `RAZORPAY_WEBHOOK_SECRET`. Never expose either
Razorpay secret to the mobile app.

Payment flow is: authenticated member creates order with `membership_plan_id`;
the app opens Razorpay using returned `order_id`, `amount` (paise), and public
`key_id`; client signature verification confirms the hint only; a valid,
idempotent Razorpay webhook atomically activates/extends membership.
