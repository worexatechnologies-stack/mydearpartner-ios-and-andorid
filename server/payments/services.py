import hashlib
import hmac
import logging
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from memberships.models import Membership
from .models import Payment

logger = logging.getLogger(__name__)

def verify_client_signature(order_id, payment_id, signature):
    if not settings.RAZORPAY_KEY_SECRET or not all(isinstance(value, str) and value for value in (order_id, payment_id, signature)):
        return False
    message = f'{order_id}|{payment_id}'.encode()
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

@transaction.atomic
def activate_payment(*, order_id, payment_id):
    payment = Payment.objects.select_for_update().select_related('plan').get(razorpay_order_id=order_id)
    if payment.razorpay_payment_id and payment.razorpay_payment_id != payment_id:
        raise ValueError('Order already has a different payment ID')
    if payment.status == Payment.Status.PAID:
        return payment
    membership, _ = Membership.objects.select_for_update().get_or_create(user=payment.user, defaults={'plan': payment.plan})
    membership.activate_or_extend(payment.plan)
    payment.status, payment.razorpay_payment_id, payment.activated_at = Payment.Status.PAID, payment_id, timezone.now()
    payment.save(update_fields=['status', 'razorpay_payment_id', 'activated_at'])
    logger.info('payment.activated order_id=%s payment_id=%s plan_id=%s state=paid', order_id, payment_id, payment.plan_id)
    return payment
