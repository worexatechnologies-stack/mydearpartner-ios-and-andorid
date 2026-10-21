from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef
from django.utils import timezone
from account_sessions.models import SessionNotice, SessionDevice
from account_sessions.services import dispatch_notice


class Command(BaseCommand):
    help = 'Retry up to 100 pending session replacement notices (run from a scheduled worker).'

    def handle(self, *args, **options):
        targets = SessionDevice.objects.filter(user_id=OuterRef('user_id'), session_id=OuterRef('session_id'))
        pending = SessionNotice.objects.filter(sent_at__isnull=True, created_at__gte=timezone.now() - timedelta(days=1))
        pending = pending.annotate(has_target=Exists(targets)).filter(has_target=True)
        for notice_id in pending.order_by('pk').values_list('pk', flat=True)[:100]:
            dispatch_notice(notice_id)
