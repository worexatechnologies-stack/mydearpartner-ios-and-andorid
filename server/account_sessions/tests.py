from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AccountSession, SessionNotice
from .services import issue_session_tokens, dispatch_notice


class SingleSessionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='member', password='test-password-123')
        self.client = APIClient()

    def status(self, pair):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + pair['access'])
        return self.client.get('/api/v1/auth/session/')

    def test_second_login_revokes_both_old_access_and_refresh(self):
        old = issue_session_tokens(self.user)
        self.assertEqual(self.status(old).status_code, 200)
        new = issue_session_tokens(self.user)
        response = self.status(old)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'session_replaced')
        self.client.credentials()
        response = self.client.post('/api/v1/auth/token/refresh/', {'refresh': old['refresh']})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'session_replaced')
        response = self.client.post('/api/v1/auth/token/refresh/', {'refresh': new['refresh']})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RefreshToken(new['refresh'])['mdp_sid'],
                         RefreshToken(response.data.get('refresh', new['refresh']))['mdp_sid'])
        self.assertEqual(self.status({'access': response.data['access']}).status_code, 200)

    def test_stale_logout_cannot_revoke_new_session(self):
        old = issue_session_tokens(self.user)
        new = issue_session_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + old['access'])
        self.assertEqual(self.client.post('/api/v1/auth/logout/').status_code, 401)
        self.assertEqual(self.status(new).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/logout/').status_code, 204)
        self.assertEqual(self.status(new).status_code, 401)

    def test_invalid_password_does_not_replace_session(self):
        old = issue_session_tokens(self.user)
        self.client.credentials()
        response = self.client.post('/api/v1/auth/login/', {'identifier': 'member', 'password': 'wrong'})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.status(old).status_code, 200)

    def test_login_response_includes_session_claim_and_user(self):
        response = self.client.post('/api/v1/auth/login/', {'identifier': 'member', 'password': 'test-password-123'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], str(self.user.pk))
        self.assertIn('mdp_sid', RefreshToken(response.data['refresh']))

    def test_other_account_is_not_affected(self):
        other = get_user_model().objects.create_user(username='other')
        old = issue_session_tokens(other)
        issue_session_tokens(self.user)
        issue_session_tokens(self.user)
        self.assertEqual(self.status(old).status_code, 200)

    def test_legacy_tokens_require_sign_in(self):
        legacy = RefreshToken.for_user(self.user)
        self.assertEqual(self.status({'access': str(legacy.access_token)}).status_code, 401)

    def test_outbox_targets_old_session_only_and_survives_transport_failure(self):
        old = issue_session_tokens(self.user)
        issue_session_tokens(self.user)
        notice = SessionNotice.objects.get()
        self.assertEqual(str(notice.session_id), RefreshToken(old['refresh'])['mdp_sid'])
        self.assertIsNone(notice.sent_at)
        with override_settings(SESSION_REPLACED_NOTIFY='production.notify'), patch(
                'account_sessions.services.import_string', return_value=lambda **kwargs: (_ for _ in ()).throw(RuntimeError())):
            dispatch_notice(notice.pk)
        notice.refresh_from_db()
        self.assertIsNone(notice.sent_at)
        received = []
        with override_settings(SESSION_REPLACED_NOTIFY='production.notify'), patch(
                'account_sessions.services.import_string', return_value=lambda **kwargs: received.append(kwargs)):
            dispatch_notice(notice.pk)
            dispatch_notice(notice.pk)
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]['session_id'], str(notice.session_id))
        self.assertNotEqual(received[0]['session_id'], str(AccountSession.objects.get(user=self.user).session_id))

    def test_push_token_registration_requires_current_session(self):
        from .models import SessionDevice
        old = issue_session_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + old['access'])
        token = 'test-device-registration-token'
        self.assertEqual(self.client.post('/api/v1/auth/session/device/', {'token': token}).status_code, 204)
        new = issue_session_tokens(self.user)
        self.assertEqual(self.client.post('/api/v1/auth/session/device/', {'token': token}).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + new['access'])
        self.assertEqual(self.client.post('/api/v1/auth/session/device/', {'token': token}).status_code, 204)
        self.assertEqual(str(SessionDevice.objects.get(token=token).session_id), RefreshToken(new['refresh'])['mdp_sid'])

    def test_security_push_targets_only_old_session(self):
        from .models import SessionDevice
        from .push import send_session_notice
        old = issue_session_tokens(self.user)
        old_sid = RefreshToken(old['refresh'])['mdp_sid']
        new = issue_session_tokens(self.user)
        new_sid = RefreshToken(new['refresh'])['mdp_sid']
        SessionDevice.objects.create(user=self.user, session_id=old_sid, token='old-device-token')
        SessionDevice.objects.create(user=self.user, session_id=new_sid, token='new-device-token')
        with patch('account_sessions.push.firebase_admin.get_app', return_value=object()), patch(
                'account_sessions.push.messaging.send') as send:
            send_session_notice(user_id=self.user.pk, session_id=old_sid, event_id='event-1')
        self.assertEqual(send.call_count, 1)
        message = send.call_args.args[0]
        self.assertEqual(message.token, 'old-device-token')
        self.assertEqual(message.data['session_id'], old_sid)
        self.assertEqual(message.data['kind'], 'session_replaced')

    def test_retry_worker_skips_notices_without_registered_targets(self):
        from django.core.management import call_command
        from .models import SessionDevice
        old = issue_session_tokens(self.user)
        issue_session_tokens(self.user)
        with patch('account_sessions.management.commands.retry_session_notices.dispatch_notice') as dispatch:
            call_command('retry_session_notices')
            dispatch.assert_not_called()
            SessionDevice.objects.create(user=self.user, session_id=RefreshToken(old['refresh'])['mdp_sid'], token='old-token')
            call_command('retry_session_notices')
            dispatch.assert_called_once_with(SessionNotice.objects.get().pk)
