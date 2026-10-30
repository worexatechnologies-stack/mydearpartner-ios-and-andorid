from __future__ import annotations
import logging
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.module_loading import import_string
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
import secrets
from django.contrib.auth.hashers import check_password, make_password
from .models import AccountSession, OtpChallenge, SessionNotice, UserPhone

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    # secrets.randbelow is cryptographically secure
    return f"{secrets.randbelow(1_000_000):06d}"


def resolve_user_phone(user) -> str | None:
    """Use only the account's explicitly verified phone record."""
    return UserPhone.objects.filter(user=user, is_verified=True).values_list('phone_number', flat=True).first()


def create_otp_challenge(user, phone_number: str, ip_address: str | None = None) -> tuple[OtpChallenge, str]:
    """
    Create a short-lived opaque verification challenge with a cryptographically secure,
    securely hashed 6-digit OTP. 5 minutes expiration, 60s resend cooldown.
    """
    now = timezone.now()
    raw_otp = generate_otp()
    otp_hash = make_password(raw_otp)

    challenge = OtpChallenge.objects.create(
        user=user,
        phone_number=phone_number,
        otp_hash=otp_hash,
        expires_at=now + timedelta(minutes=5),
        resend_available_at=now + timedelta(seconds=60),
        ip_address=ip_address,
    )
    return challenge, raw_otp


def verify_challenge_otp(challenge: OtpChallenge, submitted_otp: str) -> bool:
    """Check submitted OTP against the stored cryptographic hash."""
    if not submitted_otp or len(submitted_otp.strip()) != 6:
        return False
    return check_password(submitted_otp.strip(), challenge.otp_hash)


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

