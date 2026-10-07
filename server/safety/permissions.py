from datetime import timedelta
from django.utils import timezone
from rest_framework.permissions import BasePermission
from .models import Eligibility
from .policies import POLICY_VERSION


def is_adult(birth, today=None):
    today = today or timezone.localdate()
    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    return 18 <= age <= 120


def is_eligible(user):
    if not user or not user.is_authenticated:
        return False
    record = Eligibility.objects.filter(user=user).first()
    return bool(record and is_adult(record.date_of_birth)
                and record.policy_version == POLICY_VERSION
                and record.accepted_at > timezone.now() - timedelta(days=90))


class AdultMember(BasePermission):
    message = 'Confirm adult eligibility and accept the current policies before continuing.'

    def has_permission(self, request, view):
        return is_eligible(request.user)
