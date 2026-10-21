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
