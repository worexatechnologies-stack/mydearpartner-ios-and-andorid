from django.apps import AppConfig


class AccountSessionsConfig(AppConfig):
    name = 'account_sessions'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from . import schema  # noqa: F401
