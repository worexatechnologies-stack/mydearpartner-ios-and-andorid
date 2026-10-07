import uuid
from django.conf import settings
from django.db import models


class Eligibility(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_of_birth = models.DateField()
    policy_version = models.CharField(max_length=32)
    accepted_at = models.DateTimeField()


class SafetyRequest(models.Model):
    class Kind(models.TextChoices):
        REPORT = 'report', 'Safety report'
        DELETION = 'deletion', 'Account deletion'

    class Status(models.TextChoices):
        RECEIVED = 'received', 'Received'
        REVIEWING = 'reviewing', 'Reviewing'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=12, choices=Kind.choices)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    email = models.EmailField(blank=True)
    # Identifiers are opaque: the production profile/chat service resolves them.
    profile_id = models.CharField(max_length=128, blank=True)
    chat_id = models.CharField(max_length=128, blank=True)
    message_id = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=80, blank=True)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECEIVED)
    urgent = models.BooleanField(default=False)
    ownership_verified = models.BooleanField(default=False)
    resolution = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-urgent', 'created_at']
        indexes = [models.Index(fields=['status', 'kind'], name='safety_status_kind')]
