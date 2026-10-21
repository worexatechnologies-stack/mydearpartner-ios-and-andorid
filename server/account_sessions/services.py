import logging
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.module_loading import import_string
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AccountSession, SessionNotice

logger = logging.getLogger(__name__)


def dispatch_notice(notice_id):
    """Retry unsent rows with the production queue; provider failure never restores access."""
    transport = getattr(settings, 'SESSION_REPLACED_NOTIFY', None)
    if not transport:
        return
    notice = SessionNotice.objects.filter(pk=notice_id, sent_at__isnull=True).first()
    if not notice:
        return
    try:
        import_string(transport)(user_id=notice.user_id, session_id=str(notice.session_id),
                                 event_id=str(notice.pk))
        notice.sent_at = timezone.now()
        notice.save(update_fields=['sent_at'])
    except Exception:
        # Do not log credentials, provider payloads or exception strings.
        logger.warning('Session notice transport failed; outbox row retained for retry')


def issue_session_tokens(user):
    """Call ONLY after successful password/OTP/registration authentication."""
    with transaction.atomic():
        # Lock a row that exists even on the first login; all issuers use this lock.
        get_user_model().objects.select_for_update().get(pk=user.pk)
        previous = AccountSession.objects.filter(user=user).first()
        old_sid = previous.session_id if previous else None
        sid = uuid.uuid4()
        AccountSession.objects.update_or_create(user=user, defaults={'session_id': sid})
        refresh = RefreshToken.for_user(user)
        refresh['mdp_sid'] = str(sid)
        if old_sid:
            notice = SessionNotice.objects.create(user=user, session_id=old_sid)
            transaction.on_commit(lambda: dispatch_notice(notice.pk))
        return {'access': str(refresh.access_token), 'refresh': str(refresh)}
