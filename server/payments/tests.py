import hashlib
import hmac
import json
from unittest.mock import patch
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from memberships.models import Membership, MembershipPlan
from datetime import date
from django.utils import timezone
from safety.models import Eligibility
from safety.policies import POLICY_VERSION
from .models import Payment, WebhookEvent
from .services import activate_payment

class PaymentActivationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='member', password='safe-password')
        Eligibility.objects.create(user=self.user, date_of_birth=date(1990, 1, 1), policy_version=POLICY_VERSION, accepted_at=timezone.now())
        self.plan = MembershipPlan.objects.create(slug='gold', name='Gold', price_paise=100, duration_days=90)
        self.payment = Payment.objects.create(user=self.user, plan=self.plan, razorpay_order_id='order_test_123', amount_paise=100)

    def test_activation_is_idempotent_and_extends_once(self):
        activate_payment(order_id=self.payment.razorpay_order_id, payment_id='pay_test_123')
        membership = Membership.objects.get(user=self.user)
        original_end = membership.ends_at
        activate_payment(order_id=self.payment.razorpay_order_id, payment_id='pay_test_123')
        membership.refresh_from_db(); self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PAID)
        self.assertEqual(membership.status, Membership.Status.ACTIVE)
        self.assertEqual(membership.ends_at, original_end)

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_duplicate_captured_webhook_does_not_double_activate(self):
        payload = {'event_id': 'evt_123', 'event': 'payment.captured', 'payload': {'payment': {'entity': {'id': 'pay_test_123', 'order_id': self.payment.razorpay_order_id, 'amount': 100, 'currency': 'INR'}}}}
        raw = json.dumps(payload, separators=(',', ':')).encode()
        signature = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        client = APIClient()
        first = client.post('/api/v1/payments/webhooks/razorpay/', data=raw, content_type='application/json', HTTP_X_RAZORPAY_SIGNATURE=signature)
        second = client.post('/api/v1/payments/webhooks/razorpay/', data=raw, content_type='application/json', HTTP_X_RAZORPAY_SIGNATURE=signature)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(WebhookEvent.objects.count(), 1)
        self.assertEqual(Membership.objects.get(user=self.user).status, Membership.Status.ACTIVE)

    @patch('payments.views.client')
    def test_order_creation_uses_server_plan_amount(self, mocked_client):
        mocked_client.return_value.order.create.return_value = {'id': 'order_created_123'}
        client = APIClient(); client.force_authenticate(self.user)
        response = client.post('/api/v1/payments/orders/', {'membership_plan_id': str(self.plan.id)}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['amount'], 100)
        mocked_client.return_value.order.create.assert_called_once()

    def webhook(self, event_type='payment.captured', event_id=None, header_id=None, amount=100, currency='INR', authorization=None):
        payload = {'event': event_type, 'payload': {'payment': {'entity': {
            'id': 'pay_test_123', 'order_id': self.payment.razorpay_order_id,
            'amount': amount, 'currency': currency}}}}
        if event_id:
            payload['event_id'] = event_id
        raw = json.dumps(payload).encode()
        signature = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        headers = {'HTTP_X_RAZORPAY_SIGNATURE': signature}
        if authorization:
            headers['HTTP_AUTHORIZATION'] = authorization
        if header_id:
            headers['HTTP_X_RAZORPAY_EVENT_ID'] = header_id
        return APIClient().post('/api/v1/payments/webhooks/razorpay/', data=raw,
                                content_type='application/json', **headers)

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_mismatched_or_missing_payment_facts_never_activate_membership(self):
        for index, (amount, currency) in enumerate([(1, 'INR'), (100, 'USD'), (None, 'INR'), ('100', 'INR')]):
            with self.subTest(amount=amount, currency=currency), self.assertLogs('payments.views', level='ERROR'):
                self.assertEqual(self.webhook(event_id=f'mismatch-{index}', amount=amount, currency=currency).status_code, 500)
        self.assertFalse(Membership.objects.exists())
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.CREATED)

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_provider_signature_is_independent_of_member_authorization(self):
        self.assertEqual(self.webhook(authorization='Bearer expired-member-token').status_code, 200)

    def test_paid_order_cannot_be_reused_with_another_payment_id(self):
        activate_payment(order_id=self.payment.razorpay_order_id, payment_id='pay_test_123')
        with self.assertRaises(ValueError):
            activate_payment(order_id=self.payment.razorpay_order_id, payment_id='pay_another')

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_failed_activation_rolls_back_and_retry_succeeds_once(self):
        def activate_then_fail(**kwargs):
            activate_payment(**kwargs)
            raise RuntimeError('Temporary failure after activation')
        with patch('payments.views.activate_payment', side_effect=activate_then_fail):
            with self.assertLogs('payments.views', level='ERROR'):
                self.assertEqual(self.webhook(event_id='retry').status_code, 500)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.CREATED)
        self.assertFalse(Membership.objects.exists())
        event = WebhookEvent.objects.get(event_id='retry')
        self.assertIsNone(event.processed_at)
        self.assertTrue(event.failure_reason)
        self.assertEqual(self.webhook(event_id='retry').status_code, 200)
        event.refresh_from_db()
        self.assertIsNotNone(event.processed_at)
        self.assertEqual(event.failure_reason, '')
        end = Membership.objects.get(user=self.user).ends_at
        self.assertTrue(self.webhook(event_id='retry').data['duplicate'])
        self.assertEqual(Membership.objects.get(user=self.user).ends_at, end)

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_distinct_events_for_same_payment_are_processed(self):
        self.assertEqual(self.webhook('payment.authorized').status_code, 200)
        self.assertEqual(self.webhook().status_code, 200)
        self.assertEqual(WebhookEvent.objects.count(), 2)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PAID)
        self.assertTrue(self.webhook().data['duplicate'])

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_provider_header_identifies_delivery(self):
        self.assertEqual(self.webhook('payment.authorized', header_id='authorized').status_code, 200)
        self.assertEqual(self.webhook(header_id='captured').status_code, 200)
        self.assertSetEqual(set(WebhookEvent.objects.values_list('event_id', flat=True)), {'authorized', 'captured'})
        self.assertTrue(self.webhook(header_id='captured').data['duplicate'])

    @override_settings(RAZORPAY_WEBHOOK_SECRET='test-webhook-secret')
    def test_late_failure_does_not_downgrade_paid_order(self):
        self.assertEqual(self.webhook().status_code, 200)
        end = Membership.objects.get(user=self.user).ends_at
        self.assertEqual(self.webhook('payment.failed').status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PAID)
        self.assertEqual(self.webhook('order.paid').status_code, 200)
        self.assertEqual(Membership.objects.get(user=self.user).ends_at, end)

    @patch('payments.views.client')
    def test_invalid_plan_ids_are_rejected_before_provider_call(self, mocked_client):
        client = APIClient(); client.force_authenticate(self.user)
        for value in ['bad-id', '', None, 123, {}, []]:
            with self.subTest(value=value):
                response = client.post('/api/v1/payments/orders/', {'membership_plan_id': value}, format='json')
                self.assertEqual(response.status_code, 400)
        mocked_client.assert_not_called()

    def test_membership_expiry_is_checked_without_waiting_for_worker(self):
        from datetime import timedelta
        membership = Membership.objects.create(user=self.user, plan=self.plan,
            status=Membership.Status.ACTIVE, ends_at=timezone.now() - timedelta(seconds=1))
        client = APIClient(); client.force_authenticate(self.user)
        response = client.get('/api/v1/member/membership/')
        self.assertEqual(response.data['status'], Membership.Status.EXPIRED)
        self.assertFalse(response.data['membership_active'])
        membership.ends_at = timezone.now() + timedelta(days=1)
        membership.save(update_fields=['ends_at'])
        response = client.get('/api/v1/member/membership/')
        self.assertEqual(response.data['status'], Membership.Status.ACTIVE)
        self.assertTrue(response.data['membership_active'])


class PaymentConfigurationTests(TestCase):
    @override_settings(RAZORPAY_WEBHOOK_SECRET='')
    def test_webhook_rejects_unconfigured_secret(self):
        response = self.client.post('/api/v1/payments/webhooks/razorpay/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 503)

    @override_settings(RAZORPAY_KEY_SECRET='')
    def test_client_signature_requires_a_configured_secret(self):
        from .services import verify_client_signature
        self.assertFalse(verify_client_signature('order', 'payment', 'signature'))
