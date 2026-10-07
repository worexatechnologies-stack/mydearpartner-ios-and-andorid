import { isInterestQuotaError } from '../src/utils/interestErrors';

test.each([
  { status: 400, message: 'Interest already sent' },
  { status: 403, message: 'You cannot send interest to a blocked member' },
  { status: 400, detail: 'Invalid receiver' },
  { status: 429, message: 'Rate limit exceeded' },
  { status: 403, message: 'Upgrade to send interests' },
  new Error('Network request failed'),
  null,
])('does not exhaust daily interests for unrelated errors: %j', error => {
  expect(isInterestQuotaError(error)).toBe(false);
});

test.each([
  { message: 'Daily interest limit reached' },
  { detail: 'You have exceeded your daily interests quota.' },
  { message: 'Your interest allowance is exhausted.' },
  { code: 'daily_interests_limit_exceeded' },
])('recognizes an explicit interest quota failure: %j', error => {
  expect(isInterestQuotaError(error)).toBe(true);
});
