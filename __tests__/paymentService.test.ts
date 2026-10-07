jest.mock('../src/api/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

import { get, post } from '../src/api/apiClient';
import { createPaymentOrder, verifyPayment } from '../src/api/paymentService';

const mockedGet = get as jest.MockedFunction<typeof get>;
const mockedPost = post as jest.MockedFunction<typeof post>;

describe('payment service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a server-priced Razorpay order', async () => {
    mockedPost.mockResolvedValueOnce({
      order_id: 'order_123',
      amount: 100,
      currency: 'INR',
      key_id: 'rzp_test_123',
    });

    await expect(createPaymentOrder('plan-uuid')).resolves.toMatchObject({
      order_id: 'order_123',
      amount: 100,
    });
    expect(mockedPost).toHaveBeenCalledWith('/payments/orders/', {
      membership_plan_id: 'plan-uuid',
    });
  });

  it('normalizes the nested Razorpay response used by production servers', async () => {
    mockedPost.mockResolvedValueOnce({
      order: {
        id: 'order_nested',
        amount: '1.00',
        currency: 'INR',
        receipt: 'membership_123',
      },
    });

    await expect(createPaymentOrder('plan-uuid')).resolves.toMatchObject({
      order_id: 'order_nested',
      amount: 100,
      currency: 'INR',
    });
  });

  it('sends the server membership-plan ID to payment verification', async () => {
    mockedPost.mockResolvedValueOnce({
      status: 'active',
      membership_active: true,
      plan_slug: 'gold',
    });

    await verifyPayment({
      orderId: 'order_123',
      paymentId: 'pay_123',
      signature: 'signature',
      membershipPlanId: 'plan-uuid',
    });
    expect(mockedPost).toHaveBeenCalledWith('/payments/verify/', {
      internal_order_id: undefined,
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'signature',
      order_id: 'order_123',
      payment_id: 'pay_123',
      signature: 'signature',
      membership_plan_id: 'plan-uuid',
    });
    expect(mockedGet).not.toHaveBeenCalled();
  });
});

test('order creation does not retry an ambiguous network failure', async () => {
  mockedPost.mockClear();
  mockedPost.mockRejectedValueOnce({ isNetworkError: true });
  await expect(createPaymentOrder('plan')).rejects.toMatchObject({ isNetworkError: true });
  expect(mockedPost).toHaveBeenCalledTimes(1);
});
