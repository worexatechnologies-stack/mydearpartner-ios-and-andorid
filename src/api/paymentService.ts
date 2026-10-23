/**
 * Payment API boundary.  Razorpay secrets and payment activation must never be
 * performed by the app; the server creates the order and verifies the result.
 */
import { MAX_RETRIES } from '../config/constants';
import { BUILD_ENVIRONMENT } from '../config/env';
import { get,post } from './apiClient';

export type PaymentOrder = {
  order_id: string;
  internal_order_id?: string;
  amount: number;
  currency: string;
  key_id: string;
  receipt?: string;
};

// Razorpay Key IDs are intentionally public identifiers. The secret remains
// server-only; this fallback supports the current production order API, which
// returns a Razorpay order but not the public key ID.
const RAZORPAY_PUBLIC_KEY_ID = 'rzp_live_TPCTMw8N4aWt9A';

export type PaymentStatus = {
  payment_id?: string;
  plan_slug?: string;
  status: 'created' | 'pending' | 'paid' | 'failed' | 'active';
  membership_active: boolean;
};

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function retryNetworkCall<T>(
  call: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await call();
    } catch (error: any) {
      lastError = error;
      const retryable =
        error?.isNetworkError === true ||
        error?.status === 0 ||
        error?.status >= 500;
      
      if (!retryable || attempt === MAX_RETRIES) break;
      await wait(400 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function createPaymentOrder(
  membershipPlanId: string,
): Promise<PaymentOrder> {
  
  const response = await post<Record<string, any>>('/payments/orders/', {
    membership_plan_id: membershipPlanId,
  });
  // Production has used both flat and nested Razorpay order response shapes.
  // Normalize only provider-generated values; the client never supplies price.
  const providerOrder = response.order ?? response.razorpay_order ?? response;
  const rawAmount = providerOrder.amount ?? response.amount;
  const amount =
    typeof rawAmount === 'string' && rawAmount.includes('.')
      ? Math.round(Number(rawAmount) * 100)
      : Number(rawAmount);
  const order: PaymentOrder = {
    order_id:
      providerOrder.order_id ??
      providerOrder.razorpay_order_id ??
      providerOrder.id,
    internal_order_id:
      response.internal_order_id ??
      providerOrder.internal_order_id ??
      response.id ??
      undefined,
    amount,
    currency: providerOrder.currency ?? response.currency ?? 'INR',
    key_id:
      response.key_id ??
      response.razorpay_key_id ??
      response.key ??
      (BUILD_ENVIRONMENT === 'production' ? RAZORPAY_PUBLIC_KEY_ID : undefined),
    receipt: providerOrder.receipt ?? response.receipt,
  };
  if (
    !order?.order_id?.startsWith('order_') ||
    !order?.key_id ||
    !Number.isInteger(order.amount) ||
    order.amount <= 0
  ) {
    
    throw new Error('The payment server returned an invalid order.');
  }
  if (BUILD_ENVIRONMENT === 'staging' && !/^rzp_test_[A-Za-z0-9]+$/.test(order.key_id)) {
    throw new Error('Staging checkout requires a Razorpay sandbox key from the server.');
  }
  
  return order;
}

export async function verifyPayment(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  membershipPlanId: string;
  internalOrderId?: string;
}): Promise<PaymentStatus> {
  
  const result = await retryNetworkCall(() =>
    post<PaymentStatus>('/payments/verify/', {
      internal_order_id: input.internalOrderId,
      razorpay_order_id: input.orderId,
      razorpay_payment_id: input.paymentId,
      razorpay_signature: input.signature,
      order_id: input.orderId,
      payment_id: input.paymentId,
      signature: input.signature,
      membership_plan_id: input.membershipPlanId,
    }),
  );
  
  return result;
}

/** Server-side fallback when a success callback was interrupted after payment. */
export async function reconcilePayment(
  paymentId: string,
  membershipPlanId: string,
): Promise<PaymentStatus> {
  
  return retryNetworkCall(() =>
    post<PaymentStatus>('/payments/reconcile/', {
      razorpay_payment_id: paymentId,
      membership_plan_id: membershipPlanId,
    }),
  );
}

export async function getPaymentStatus(
  paymentId: string,
): Promise<PaymentStatus> {
  return retryNetworkCall(() =>
    get<PaymentStatus>(
      `/payments/status/?payment_id=${encodeURIComponent(paymentId)}`,
    ),
  );
}

/** Poll briefly after a successful payment while a webhook is being delivered. */
export async function waitForMembershipActivation(
  paymentId: string,
): Promise<PaymentStatus | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const status = await getPaymentStatus(paymentId);
      
      if (
        status.membership_active ||
        status.status === 'active' ||
        status.status === 'paid'
      )
        return status;
    } catch {
      
    }
    await wait(1000 * (attempt + 1));
  }
  return null;
}
