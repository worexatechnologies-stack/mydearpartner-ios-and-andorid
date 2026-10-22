import hashlib
import hmac
import json
import logging
import razorpay
from django.conf import settings
from django.db import transaction
from django.http import HttpResponseBadRequest
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import authentication_classes
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiTypes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from memberships.models import Membership, MembershipPlan
from safety.permissions import AdultMember
from .models import Payment, WebhookEvent
from .services import activate_payment, verify_client_signature

logger = logging.getLogger(__name__)

class OrderInput(serializers.Serializer):
    membership_plan_id = serializers.UUIDField()


class VerificationInput(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


order_response = inline_serializer('PaymentOrderResponse', fields={
    'order_id': serializers.CharField(), 'amount': serializers.IntegerField(),
    'currency': serializers.CharField(), 'key_id': serializers.CharField(),
})
verification_response = inline_serializer('PaymentVerificationResponse', fields={
    'status': serializers.CharField(), 'membership_active': serializers.BooleanField(),
    'payment_id': serializers.CharField(),
})
membership_response = inline_serializer('MembershipResponse', fields={
    'status': serializers.CharField(), 'membership_active': serializers.BooleanField(),
    'plan_slug': serializers.CharField(), 'ends_at': serializers.DateTimeField(required=False, allow_null=True),
})

def client(): return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

@extend_schema(request=OrderInput, responses=order_response)
@api_view(['POST'])
@permission_classes([IsAuthenticated, AdultMember])
def create_order(request):
    plan_id = serializers.UUIDField().run_validation(request.data.get('membership_plan_id'))
    try: plan = MembershipPlan.objects.get(id=plan_id, is_active=True, price_paise__gt=0)
    except MembershipPlan.DoesNotExist: return Response({'detail': 'A valid paid membership_plan_id is required.'}, status=400)
    receipt = f'mdp_{str(request.user.id)[:12]}_{str(plan.id)[:12]}'
    order = client().order.create({'amount': plan.price_paise, 'currency': 'INR', 'receipt': receipt, 'payment_capture': 1, 'notes': {'user_id': str(request.user.id), 'membership_plan_id': str(plan.id)}})
    payment = Payment.objects.create(user=request.user, plan=plan, razorpay_order_id=order['id'], amount_paise=plan.price_paise)
    logger.info('payment.order_created plan_id=%s order_id=%s payment_row_id=%s', plan.id, payment.razorpay_order_id, payment.id)
    return Response({'order_id': order['id'], 'amount': plan.price_paise, 'currency': 'INR', 'key_id': settings.RAZORPAY_KEY_ID})

@extend_schema(request=VerificationInput, responses=verification_response)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    order_id, payment_id, signature = (request.data.get(k) for k in ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'))
    if not all((order_id, payment_id, signature)) or not verify_client_signature(order_id, payment_id, signature): return Response({'detail': 'Invalid payment signature.'}, status=400)
    try: payment = Payment.objects.get(razorpay_order_id=order_id, user=request.user)
    except Payment.DoesNotExist: return Response({'detail': 'Payment order not found.'}, status=404)
    # Client verification never activates membership: webhook remains authority.
    membership = Membership.objects.filter(user=request.user, status=Membership.Status.ACTIVE,
                                            ends_at__gt=timezone.now()).exists()
    return Response({'status': payment.status, 'membership_active': membership, 'payment_id': payment_id})

@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, auth=[])
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def razorpay_webhook(request):
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        return Response({'detail': 'Payment notifications are not configured.'}, status=503)
    raw, signature = request.body, request.headers.get('X-Razorpay-Signature', '')
    expected = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if len(signature) != 64 or not signature.isascii():
        return HttpResponseBadRequest('Invalid webhook signature')
    if not signature or not hmac.compare_digest(expected, signature): return HttpResponseBadRequest('Invalid webhook signature')
    try:
        payload = json.loads(raw.decode())
        event_type = payload['event']
        entity = payload['payload']['payment']['entity']
        order_id, payment_id = entity['order_id'], entity['id']
        if not all(isinstance(value, str) and value for value in (event_type, order_id, payment_id)):
            raise ValueError('Missing event or payment identifiers')
    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
        return HttpResponseBadRequest('Malformed webhook payload')
    # Provider delivery IDs distinguish different events for the same payment.
    # A canonical payload digest also preserves that distinction for old clients.
    event_id = request.headers.get('X-Razorpay-Event-Id') or payload.get('event_id')
    if not event_id:
        event_id = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if not isinstance(event_id, str) or len(event_id) > 100:
        return HttpResponseBadRequest('Malformed webhook event ID')
    with transaction.atomic():
        event, _ = WebhookEvent.objects.select_for_update().get_or_create(
            event_id=event_id, defaults={'event_type': event_type, 'payload': payload})
        if event.processed_at:
            return Response({'ok': True, 'duplicate': True})
        try:
            # Roll activation back on failure while retaining a retryable event.
            # The outer row lock serializes concurrent deliveries of this event.
            with transaction.atomic():
                if event_type in ('payment.captured', 'order.paid'):
                    payment = Payment.objects.select_for_update().get(razorpay_order_id=order_id)
                    if (type(entity.get('amount')) is not int or
                            entity['amount'] != payment.amount_paise or
                            entity.get('currency') != payment.currency):
                        raise ValueError('Payment amount or currency does not match the order')
                    activate_payment(order_id=order_id, payment_id=payment_id)
                elif event_type == 'payment.failed':
                    Payment.objects.filter(razorpay_order_id=order_id).exclude(
                        status=Payment.Status.PAID).update(status=Payment.Status.FAILED)
                event.processed_at = timezone.now()
                event.failure_reason = ''
                event.save(update_fields=['processed_at', 'failure_reason'])
        except Exception as exc:
            event.failure_reason = str(exc)
            event.save(update_fields=['failure_reason'])
            logger.exception('payment.webhook_failed event_id=%s', event_id)
            return Response({'detail': 'Webhook processing failed.'}, status=500)
    return Response({'ok': True})

@extend_schema(responses=membership_response)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_membership(request):
    membership = Membership.objects.filter(user=request.user).select_related('plan').first()
    if not membership: return Response({'status': 'expired', 'membership_active': False, 'plan_slug': 'free'})
    active = bool(membership.status == Membership.Status.ACTIVE and membership.ends_at and membership.ends_at > timezone.now())
    status = Membership.Status.EXPIRED if membership.status == Membership.Status.ACTIVE and not active else membership.status
    return Response({'status': status, 'membership_active': active, 'plan_slug': membership.plan.slug, 'ends_at': membership.ends_at})
