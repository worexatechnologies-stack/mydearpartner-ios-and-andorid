from django.conf import settings
from django.db import models
from django.utils import timezone
import uuid
from datetime import timedelta

class MembershipPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    price_paise = models.PositiveIntegerField()
    duration_days = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    feature_limits = models.JSONField(default=dict)

class Membership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class Status(models.TextChoices): ACTIVE = 'active'; EXPIRED = 'expired'; CANCELLED = 'cancelled'; GRACE = 'grace'
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(MembershipPlan, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.EXPIRED)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    def activate_or_extend(self, plan):
        base = self.ends_at if self.status == self.Status.ACTIVE and self.ends_at and self.ends_at > timezone.now() else timezone.now()
        self.plan, self.status, self.starts_at, self.ends_at = plan, self.Status.ACTIVE, timezone.now(), base + timedelta(days=plan.duration_days)
        self.save(update_fields=['plan', 'status', 'starts_at', 'ends_at'])
