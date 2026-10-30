import uuid
from django.conf import settings
from django.db import models


class AccountSession(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_id = models.UUIDField(default=uuid.uuid4)
    updated_at = models.DateTimeField(auto_now=True)


class SessionNotice(models.Model):
    """Durable outbox; production transport must target only the OLD session."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)


class SessionDevice(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_id = models.UUIDField(db_index=True)
    token = models.CharField(max_length=4096, unique=True)
    updated_at = models.DateTimeField(auto_now=True)


class UserPhone(models.Model):
    """Registered and verified mobile number for SMS 2FA/OTP login."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='phone_record')
    phone_number = models.CharField(max_length=32, unique=True, db_index=True)
    is_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user_id}: {self.phone_number}"


class OtpChallenge(models.Model):
    """Short-lived, opaque verification challenge for two-step SMS OTP authentication."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otp_challenges')
    phone_number = models.CharField(max_length=32, db_index=True)
    otp_hash = models.CharField(max_length=256)
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    is_consumed = models.BooleanField(default=False)
    is_superseded = models.BooleanField(default=False)
    expires_at = models.DateTimeField(db_index=True)
    resend_available_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='otp_user_created_idx'),
            models.Index(fields=['phone_number', '-created_at'], name='otp_phone_created_idx'),
        ]

    def __str__(self):
        return f"Challenge {self.id} for user {self.user_id}"

