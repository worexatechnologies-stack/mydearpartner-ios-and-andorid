# Production payment backend requirements

The mobile app now uses these authenticated endpoints. Implement them in the
**deployed Django API** (the Django source is not included in this repository),
under `/api/v1/payments/`.

| Endpoint | Behaviour |
| --- | --- |
| `POST orders/` | Accept `{ membership_plan_id }`; load an active plan server-side; create a Razorpay order in paise with a receipt containing the authenticated user ID; persist a `Payment` row in `created`; return `{ order_id, amount, currency, key_id }`. Never accept price, duration, account ID, or Razorpay key secret from the client. |
| `POST verify/` | Accept Razorpay `order_id`, `payment_id`, and `signature`; require the authenticated user to own the stored order; verify `HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` with `hmac.compare_digest`; fetch the payment from Razorpay and require its status to be `captured`; atomically mark the payment paid and create/update the user membership. Return `{ status: "active", membership_active: true, plan_slug }`. |
| `POST reconcile/` | Accept a payment ID for the authenticated user's stored order. Fetch it from Razorpay, then run the same transactional activation routine as `verify/`. It must not trust a client-provided plan or payment status. |
| `GET status/?payment_id=` | Return only the authenticated user's payment: `{ status, membership_active, plan_slug, payment_id }`. |
| `POST webhook/` | Public, CSRF-exempt endpoint. Read the **raw request body**, verify `X-Razorpay-Signature` using `RAZORPAY_WEBHOOK_SECRET` and `hmac.compare_digest`, process `payment.captured` (and order-paid events if enabled), and invoke the same idempotent activation routine. Return non-2xx on invalid signature or processing failure so Razorpay retries. |

## Required data and transaction rules

Persist at least: `user`, `plan`, `razorpay_order_id` (unique),
`razorpay_payment_id` (unique, nullable), `amount_paise`, `currency`,
`status`, `activated_at`, and raw provider event ID(s) for idempotency. Link
the record to the authenticated user at order creation—never by email supplied
by the client.

The activation routine must run inside `transaction.atomic()` and lock the
payment row (`select_for_update()`). If it is already paid, return its current
membership rather than granting a second membership. It must set the exact
fields serialized by `/auth/me/`:

```python
# illustrative shared activation routine
membership.plan = payment.plan
membership.is_active = True
membership.starts_at = timezone.now()
membership.ends_at = membership.starts_at + timedelta(days=payment.plan.duration_days)
membership.save(update_fields=["plan", "is_active", "starts_at", "ends_at"])
payment.status = "paid"
payment.razorpay_payment_id = payment_id
payment.activated_at = timezone.now()
payment.save(update_fields=["status", "razorpay_payment_id", "activated_at"])
```

Emit structured server logs for `payment.order_created`, `payment.webhook_received`,
`payment.webhook_signature_verified`, `payment.activated`, and
`payment.activation_failed`. Include request/event/order/payment IDs only; do
not log signatures, tokens, card data, or email/phone numbers. Do not catch and
silently ignore database or signature errors.

## Django route and middleware requirements

Register the webhook outside JWT/session authentication; it needs only raw
body signature validation. Do not apply a JSON body parser before preserving
the raw bytes used in the HMAC. CORS is irrelevant to Razorpay webhooks, but
the endpoint must be publicly reachable over HTTPS and must not be redirected
to a login page.

The live API paths are `POST /api/v1/payments/orders/`, `POST /api/v1/payments/verify/`, and `POST /api/v1/payments/webhooks/razorpay/`. Register this exact live URL in Razorpay Dashboard after deployment:

```
https://mydearpartner.in/api/v1/payments/webhooks/razorpay/
```

Enable `payment.captured` and keep the dashboard webhook secret equal to
`RAZORPAY_WEBHOOK_SECRET`. The Django environment needs:

```
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PAYMENT_MODE=razorpay
```

`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only values;
the mobile app receives only `key_id` in the order response. Remove the legacy
`PAYMENT_MODE=manual_approval` mode after the integration is deployed.
