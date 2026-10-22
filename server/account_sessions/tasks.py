from celery import shared_task
from django.core.management import call_command


@shared_task(ignore_result=True)
def retry_session_notices():
    """Drain the bounded, retryable security-notice outbox from Celery beat."""
    call_command('retry_session_notices')
