from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AccountSession, OtpChallenge, UserPhone
from .services import issue_session_tokens
from .sms import SmsDeliveryError


@override_settings(SESSION_REPLACED_NOTIFY='')
class LoginOtpTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='MDP123', email='member@example.com', password='test-password-123')
        UserPhone.objects.create(user=self.user, phone_number='9876543210')
        self.client = APIClient()
        self.sms = patch('account_sessions.views.send_sms_otp', return_value=True).start()
        self.addCleanup(patch.stopall)

    def login(self, identifier='MDP123', **extra):
        return self.client.post('/api/v1/auth/login/', {
            'identifier': identifier, 'password': 'test-password-123', **extra})

    def challenge(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        return response.data['challenge_id'], self.sms.call_args.args[1]

    def verify(self, challenge_id, otp):
        return self.client.post('/api/v1/auth/login/verify/', {'challenge_id': challenge_id, 'otp': otp})

    def allow_resend(self, challenge_id):
        OtpChallenge.objects.filter(pk=challenge_id).update(resend_available_at=timezone.now() - timedelta(seconds=1))

    def test_id_email_and_mobile_require_password_then_otp(self):
        for identifier in ['MDP123', 'MEMBER@example.com', '9876543210']:
            with self.subTest(identifier=identifier):
                OtpChallenge.objects.all().delete()
                response = self.login(identifier, skip_otp=True, otp='123456')
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data['requires_otp'])
                self.assertNotIn('access', response.data)
                self.assertNotIn('otp', response.data)
                self.assertFalse(AccountSession.objects.exists())

    def test_wrong_password_never_sends_a_code(self):
        response = self.login(password='wrong')
        self.assertEqual(response.status_code, 401)
        self.sms.assert_not_called()

    def test_missing_registered_mobile_never_bypasses_otp(self):
        UserPhone.objects.all().delete()
        self.assertEqual(self.login().status_code, 400)
        self.assertFalse(AccountSession.objects.exists())

    def test_unverified_mobile_is_not_used(self):
        UserPhone.objects.filter(user=self.user).update(is_verified=False)
        self.assertEqual(self.login().status_code, 400)
        self.sms.assert_not_called()

    def test_mobile_username_does_not_substitute_for_verified_phone(self):
        UserPhone.objects.all().delete()
        self.user.username = '9876543210'
        self.user.save()
        self.assertEqual(self.login(identifier='9876543210').status_code, 400)
        self.sms.assert_not_called()

    def test_changed_or_revoked_phone_invalidates_verification_and_resend(self):
        challenge, otp = self.challenge()
        self.allow_resend(challenge)
        for change in [{'phone_number': '9876543211'}, {'is_verified': False}]:
            with self.subTest(change=change):
                UserPhone.objects.filter(user=self.user).update(**change)
                self.assertEqual(self.verify(challenge, otp).status_code, 401)
                self.assertEqual(self.client.post('/api/v1/auth/login/resend-otp/', {
                    'challenge_id': challenge,
                }).status_code, 401)
                self.assertFalse(AccountSession.objects.exists())
                UserPhone.objects.filter(user=self.user).update(phone_number='9876543210', is_verified=True)
        self.assertEqual(self.sms.call_count, 1)

    def test_success_consumes_code_and_replay_fails(self):
        challenge, otp = self.challenge()
        self.assertEqual(self.verify(challenge, otp).status_code, 200)
        self.assertEqual(self.verify(challenge, otp).status_code, 401)

    def test_expired_code_and_inactive_account_are_rejected(self):
        challenge, otp = self.challenge()
        OtpChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify(challenge, otp).status_code, 401)
        OtpChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() + timedelta(minutes=1))
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.verify(challenge, otp).status_code, 401)
        self.assertFalse(AccountSession.objects.exists())

    def test_failed_attempts_persist_and_lock_out_even_the_correct_code(self):
        challenge, otp = self.challenge()
        wrong = '000000' if otp != '000000' else '111111'
        for _ in range(5):
            self.assertEqual(self.verify(challenge, wrong).status_code, 401)
        self.assertEqual(OtpChallenge.objects.get(pk=challenge).attempts, 5)
        self.assertEqual(self.verify(challenge, otp).status_code, 401)
        self.assertFalse(AccountSession.objects.exists())

    def test_resend_has_cooldown_and_invalidates_previous_code(self):
        challenge, otp = self.challenge()
        endpoint = '/api/v1/auth/login/resend-otp/'
        self.assertEqual(self.client.post(endpoint, {'challenge_id': challenge}).status_code, 400)
        self.allow_resend(challenge)
        response = self.client.post(endpoint, {'challenge_id': challenge})
        self.assertEqual(response.status_code, 200)
        replacement = response.data['challenge_id']
        new_otp = self.sms.call_args.args[1]
        self.assertNotEqual(challenge, replacement)
        self.assertEqual(self.verify(challenge, otp).status_code, 401)
        self.assertEqual(self.verify(replacement, new_otp).status_code, 200)
        self.assertEqual(self.client.post(endpoint, {'challenge_id': replacement}).status_code, 401)

    def test_verification_and_resend_require_an_opaque_challenge(self):
        for endpoint in ['verify', 'resend-otp']:
            response = self.client.post(f'/api/v1/auth/login/{endpoint}/', {'identifier': '', 'mobile': '', 'otp': '123456'})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.verify('not-a-uuid', '123456').status_code, 400)

    def test_password_alone_does_not_replace_an_existing_session(self):
        old = issue_session_tokens(self.user)
        self.challenge()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + old['access'])
        self.assertEqual(self.client.get('/api/v1/auth/session/').status_code, 200)

    def test_sms_failure_rolls_back_new_challenge(self):
        self.sms.side_effect = SmsDeliveryError('provider unavailable')
        self.assertEqual(self.login().status_code, 503)
        self.assertFalse(OtpChallenge.objects.exists())
        self.assertFalse(AccountSession.objects.exists())

    def test_missing_sms_credentials_never_silently_simulates_delivery(self):
        from .sms import send_sms_otp
        with patch.dict('os.environ', {
            'TESTING': 'false', 'DJANGO_SETTINGS_MODULE': 'config.settings',
            'SMS_PROVIDER': 'renflair', 'RENFLAIR_API_KEY': '',
        }):
            with self.assertRaises(SmsDeliveryError):
                send_sms_otp('9876543210', '123456')
