from django import forms
from django.db import transaction
from django.shortcuts import render
from django.http import Http404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from .models import Eligibility, SafetyRequest
from .permissions import is_eligible
from .policies import DOCUMENTS, POLICY_VERSION
from .serializers import EligibilitySerializer, ReportSerializer, DeletionSerializer
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, inline_serializer

eligibility_response = inline_serializer('EligibilityResponse', fields={
    'eligible': serializers.BooleanField(), 'policy_version': serializers.CharField(),
})
receipt_response = inline_serializer('SafetyReceipt', fields={
    'id': serializers.UUIDField(), 'status': serializers.CharField(),
})


class SafetyThrottle(UserRateThrottle):
    rate = '30/hour'


@extend_schema(methods=['GET'], responses=eligibility_response)
@extend_schema(methods=['POST'], request=EligibilitySerializer, responses=eligibility_response)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([SafetyThrottle])
def eligibility(request):
    if request.method == 'POST':
        serializer = EligibilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            # Lock the user row too: a first attestation has no Eligibility row to lock.
            type(request.user).objects.select_for_update().get(pk=request.user.pk)
            record = Eligibility.objects.filter(user=request.user).first()
            if record and record.date_of_birth != data['date_of_birth']:
                return Response({'detail': 'Contact support to correct your recorded birth date.'}, status=400)
            Eligibility.objects.update_or_create(user=request.user, defaults={
                'date_of_birth': data['date_of_birth'], 'policy_version': POLICY_VERSION,
                'accepted_at': timezone.now(),
            })
    return Response({'eligible': is_eligible(request.user), 'policy_version': POLICY_VERSION})


def received(record):
    return Response({'id': str(record.id), 'status': 'received'}, status=202)


@extend_schema(request=ReportSerializer, responses={202: receipt_response})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([SafetyThrottle])
def report(request):
    serializer = ReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    record = SafetyRequest.objects.create(
        kind=SafetyRequest.Kind.REPORT, user=request.user,
        urgent=data['reason'] in ['Underage user', 'Child exploitation or abuse', 'Non-consensual intimate content', 'Harassment or threats'],
        **data,
    )
    return received(record)


@extend_schema(request=DeletionSerializer, responses={202: receipt_response})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([SafetyThrottle])
def account_deletion(request):
    serializer = DeletionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        type(request.user).objects.select_for_update().get(pk=request.user.pk)
        record = SafetyRequest.objects.filter(user=request.user, kind='deletion', status__in=['received', 'reviewing']).first()
        if not record:
            record = SafetyRequest.objects.create(kind='deletion', user=request.user,
                email=getattr(request.user, 'email', ''), ownership_verified=True)
    return received(record)


def child_safety_standards(request):
    return render(request, 'safety/child_safety_standards.html')


def policy_page(request, page):
    if page in ('safety', 'child-safety', 'child-safety-standards'):
        return render(request, 'safety/child_safety_standards.html')
    if page not in ('privacy', 'terms'):
        raise Http404
    return render(request, 'safety/policy.html', {'policy': DOCUMENTS[page], 'version': POLICY_VERSION})


class DeletionForm(forms.Form):
    email = forms.EmailField(label='Email address associated with your My Dear Partner account')
    confirm = forms.BooleanField(label='I request deletion of my account and associated data.')


@require_http_methods(['GET', 'POST'])
def deletion_page(request):
    form = DeletionForm(request.POST or None)
    submitted = False
    if request.method == 'POST' and form.is_valid():
        # Do not trust an arbitrary X-Forwarded-For header. Configure edge rate limiting too.
        key = 'deletion-form:' + request.META.get('REMOTE_ADDR', 'unknown')
        count = cache.get(key, 0)
        if count >= 5:
            form.add_error(None, 'Too many requests. Please retry later or contact support@mydearpartner.in.')
        else:
            cache.set(key, count + 1, 3600)
            # No account lookup or automatic deletion. Staff must verify ownership.
            SafetyRequest.objects.create(kind='deletion', email=form.cleaned_data['email'])
            submitted = True
    return render(request, 'safety/deletion.html', {'form': form, 'submitted': submitted})
