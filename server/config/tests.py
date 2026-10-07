import os
import subprocess
import sys
from django.conf import settings
from django.test import SimpleTestCase


class ProductionSecretTests(SimpleTestCase):
    def check_settings(self, additions):
        environment = {key: value for key, value in os.environ.items()
                       if key not in ('DJANGO_SECRET_KEY', 'DJANGO_DEBUG')}
        environment.update(additions)
        return subprocess.run([sys.executable, '-c', 'import config.settings'],
                              cwd=settings.BASE_DIR, env=environment,
                              capture_output=True, text=True)

    def test_missing_production_secret_fails_closed(self):
        result = self.check_settings({})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_SECRET_KEY must be configured', result.stderr)

    def test_example_secret_cannot_be_used_in_production(self):
        result = self.check_settings({'DJANGO_SECRET_KEY': 'replace-with-a-long-random-secret'})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('strong, unique production secret', result.stderr)

    def test_explicit_development_can_start_without_a_secret(self):
        self.assertEqual(self.check_settings({'DJANGO_DEBUG': 'true'}).returncode, 0)

    def test_configured_production_can_start(self):
        self.assertEqual(self.check_settings({'DJANGO_SECRET_KEY':
            'qa-only-41fd718d2e24f1abe4c41cd1e959bc91326477a0a85fa19f'}).returncode, 0)
