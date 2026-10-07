from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, Client
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Eligibility, SafetyRequest
from .permissions import is_adult, is_eligible
from .policies import POLICY_VERSION


class SafetyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username='adult', email='adult@example.com', password='test-password')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def accept(self, **changes):
        data = {'date_of_birth': '1990-01-01', 'policy_version': POLICY_VERSION, 'accepted': True}
        data.update(changes)
        return self.client.post('/api/v1/safety/eligibility/', data, format='json')

    def test_age_boundary_and_leap_day(self):
        self.assertFalse(is_adult(date(2008, 9, 29), date(2026, 9, 28)))
        self.assertTrue(is_adult(date(2008, 9, 28), date(2026, 9, 28)))
        self.assertFalse(is_adult(date(2008, 2, 29), date(2026, 2, 28)))
        self.assertTrue(is_adult(date(2008, 2, 29), date(2026, 3, 1)))

    def test_eligibility_requires_adult_current_explicit_acceptance(self):
        for changes in [{'date_of_birth': timezone.localdate().isoformat()}, {'policy_version': 'old'}, {'accepted': False}, {'date_of_birth': '2000-02-31'}]:
            self.assertEqual(self.accept(**changes).status_code, 400)
        self.assertFalse(is_eligible(self.user))
        self.assertEqual(self.accept().status_code, 200)
        self.assertTrue(is_eligible(self.user))
        self.assertEqual(self.accept(date_of_birth='1989-01-01').status_code, 400)
        Eligibility.objects.filter(user=self.user).update(accepted_at=timezone.now() - timedelta(days=91))
        self.assertFalse(is_eligible(self.user))

    def test_report_persisted_and_urgent_without_exposing_other_reports(self):
        response = self.client.post('/api/v1/safety/reports/', {'profile_id': 'profile-42', 'reason': 'Child exploitation or abuse', 'details': 'Please review profile'}, format='json')
        self.assertEqual(response.status_code, 202)
        report = SafetyRequest.objects.get(pk=response.data['id'])
        self.assertTrue(report.urgent)
        self.assertEqual(report.user, self.user)
        self.assertEqual(self.client.get('/api/v1/safety/reports/').status_code, 405)

    def test_invalid_report_not_saved(self):
        response = self.client.post('/api/v1/safety/reports/', {'profile_id': 'p', 'reason': 'made up'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SafetyRequest.objects.count(), 0)

    def test_deletion_is_confirmed_idempotent_and_does_not_claim_completion(self):
        self.assertEqual(self.client.post('/api/v1/safety/account-deletion/', {'confirm': False}, format='json').status_code, 400)
        first = self.client.post('/api/v1/safety/account-deletion/', {'confirm': True}, format='json')
        second = self.client.post('/api/v1/safety/account-deletion/', {'confirm': True}, format='json')
        self.assertEqual(first.status_code, 202)
        self.assertEqual(first.data, second.data)
        self.assertEqual(first.data['status'], 'received')
        self.assertTrue(SafetyRequest.objects.get().ownership_verified)
        self.assertTrue(get_user_model().objects.filter(pk=self.user.pk).exists())

    def test_unauthenticated_api_requests_rejected(self):
        self.client.force_authenticate(None)
        for path in ['reports', 'account-deletion', 'eligibility']:
            self.assertEqual(self.client.post(f'/api/v1/safety/{path}/', {}, format='json').status_code, 401)

    def test_public_deletion_does_not_associate_or_delete_an_unverified_user(self):
        response = Client().post('/account-deletion/', {'email': self.user.email, 'confirm': 'on'})
        self.assertContains(response, 'Your request has been received')
        request = SafetyRequest.objects.get()
        self.assertFalse(request.ownership_verified)
        self.assertIsNone(request.user)
        self.assertTrue(get_user_model().objects.filter(pk=self.user.pk).exists())

    def test_public_form_csrf_and_policy_pages(self):
        self.assertEqual(Client(enforce_csrf_checks=True).post('/account-deletion/', {'email': 'x@example.com', 'confirm': 'on'}).status_code, 403)
        for page in ['privacy', 'terms', 'safety']:
            self.assertContains(Client().get(f'/policies/{page}/'), 'My Dear Partner')

    def test_public_deletion_rate_limit(self):
        client = Client()
        for _ in range(6):
            response = client.post('/account-deletion/', {'email': 'x@example.com', 'confirm': 'on'})
        self.assertContains(response, 'Too many requests')
        self.assertEqual(SafetyRequest.objects.count(), 5)

    def test_paid_checkout_cannot_bypass_eligibility(self):
        response = self.client.post('/api/v1/payments/orders/', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_authenticated_request_cannot_choose_another_account_for_deletion(self):
        other = get_user_model().objects.create_user(username='other', email='other@example.com')
        response = self.client.post('/api/v1/safety/account-deletion/', {'confirm': True, 'user': other.pk, 'email': other.email}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(SafetyRequest.objects.get().user, self.user)
