from celery import shared_task
from django.utils import timezone
from .models import Membership
@shared_task
def expire_memberships():
    return Membership.objects.filter(status='active', ends_at__lte=timezone.now()).update(status='expired')
