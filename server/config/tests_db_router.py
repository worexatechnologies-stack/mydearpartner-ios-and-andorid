import unittest
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase, override_settings
from config.db_router import DatabaseLoadBalancerRouter


class DatabaseLoadBalancerRouterTests(SimpleTestCase):
    def setUp(self):
        self.router = DatabaseLoadBalancerRouter()
        self.mock_model = MagicMock()

    @override_settings(DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3'},
                                 'replica': {'ENGINE': 'django.db.backends.sqlite3'}})
    def test_security_and_payment_reads_use_primary_despite_replicas(self):
        for label in ('auth', 'sessions', 'account_sessions', 'payments', 'memberships', 'safety'):
            with self.subTest(label=label):
                self.mock_model._meta.app_label = label
                self.assertEqual(self.router.db_for_read(self.mock_model), 'default')

    @override_settings(DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3'},
                                 'replica': {'ENGINE': 'django.db.backends.sqlite3'}})
    def test_reads_in_primary_transaction_stay_on_primary(self):
        self.mock_model._meta.app_label = 'profiles'
        with patch('config.db_router.connections') as connections:
            connections['default'].in_atomic_block = True
            self.assertEqual(self.router.db_for_read(self.mock_model), 'default')

    def test_writes_always_route_to_default(self):
        """Writes must strictly route to the primary/leader node."""
        self.assertEqual(self.router.db_for_write(self.mock_model), 'default')

    def test_reads_fallback_to_default_when_no_replicas(self):
        """When no read replicas are configured, reads fall back to default."""
        with override_settings(DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3'}}):
            self.assertEqual(self.router.db_for_read(self.mock_model), 'default')

    def test_reads_route_to_single_replica(self):
        """When a replica is configured, reads route to it."""
        mock_dbs = {
            'default': {'ENGINE': 'django.db.backends.sqlite3'},
            'replica': {'ENGINE': 'django.db.backends.sqlite3'},
        }
        with override_settings(DATABASES=mock_dbs):
            self.assertEqual(self.router.db_for_read(self.mock_model), 'replica')

    def test_reads_load_balance_across_multiple_replicas_round_robin(self):
        """Multiple replicas should be load-balanced across requests."""
        mock_dbs = {
            'default': {'ENGINE': 'django.db.backends.sqlite3'},
            'replica': {'ENGINE': 'django.db.backends.sqlite3'},
            'replica_2': {'ENGINE': 'django.db.backends.sqlite3'},
        }
        with override_settings(DATABASES=mock_dbs, DB_LOAD_BALANCER_STRATEGY='round_robin'):
            first = self.router.db_for_read(self.mock_model)
            second = self.router.db_for_read(self.mock_model)
            third = self.router.db_for_read(self.mock_model)
            fourth = self.router.db_for_read(self.mock_model)

            self.assertIn(first, ('replica', 'replica_2'))
            self.assertIn(second, ('replica', 'replica_2'))
            # Round-robin alternates between the replicas
            self.assertNotEqual(first, second)
            self.assertEqual(first, third)
            self.assertEqual(second, fourth)

    def test_migrations_only_allowed_on_default(self):
        """Migrations must never run on read replicas."""
        self.assertTrue(self.router.allow_migrate('default', 'account_sessions'))
        self.assertFalse(self.router.allow_migrate('replica', 'account_sessions'))
        self.assertFalse(self.router.allow_migrate('replica_2', 'account_sessions'))

    def test_relations_allowed_within_cluster(self):
        """Relations between default and replica models should be allowed."""
        mock_dbs = {
            'default': {'ENGINE': 'django.db.backends.sqlite3'},
            'replica': {'ENGINE': 'django.db.backends.sqlite3'},
        }
        with override_settings(DATABASES=mock_dbs):
            obj1 = MagicMock()
            obj1._state.db = 'default'
            obj2 = MagicMock()
            obj2._state.db = 'replica'
            self.assertTrue(self.router.allow_relation(obj1, obj2))

            external_obj = MagicMock()
            external_obj._state.db = 'analytics_unrelated'
            self.assertIsNone(self.router.allow_relation(obj1, external_obj))
