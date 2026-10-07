from django.conf import settings
from django.db import models
from memberships.models import MembershipPlan
import uuid

class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class Status(models.TextChoices): CREATED = 'created'; PAID = 'paid'; FAILED = 'failed'
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    plan = models.ForeignKey(MembershipPlan, on_delete=models.PROTECT)
    razorpay_order_id = models.CharField(max_length=64, unique=True)
    razorpay_payment_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    amount_paise = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default='INR')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CREATED)
    activated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class WebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    processed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
