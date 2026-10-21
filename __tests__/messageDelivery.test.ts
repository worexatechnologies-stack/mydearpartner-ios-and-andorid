import { confirmedDelivery, failureDelivery, restoreMessageDelivery } from '../src/utils/messageDelivery';
import { Message } from '../src/types/models';
test('only explicit server receipts establish read or delivered', () => {
  expect(confirmedDelivery({ id: 'saved' })).toBe('sent');
  expect(confirmedDelivery({ is_read: 'true', read_at: 'invalid' })).toBe('sent');
  expect(confirmedDelivery({ is_read: true })).toBe('read');
  expect(confirmedDelivery({ delivered_at: '2026-10-19T10:00:00Z' })).toBe('delivered');
});
test('network failures and timeouts cannot be blindly retried', () => {
  expect(failureDelivery({ status: 0 }, true)).toBe('unconfirmed');
  expect(failureDelivery({ status: 500 }, true)).toBe('unconfirmed');
  expect(failureDelivery({ status: 408 }, true)).toBe('unconfirmed');
  expect(failureDelivery({ status: 403 }, true)).toBe('failed');
  expect(failureDelivery(new Error('Encryption failed'), false)).toBe('failed');
});
test('process-interrupted sends restore with unknown delivery', () => {
  const row = { id: 'local', deliveryStatus: 'sending' } as Message;
  expect(restoreMessageDelivery({ chat: [row] }).chat[0].deliveryStatus).toBe('unconfirmed');
  expect(row.deliveryStatus).toBe('sending');
});
