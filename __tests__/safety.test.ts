import { adultDateOfBirth } from '../src/utils/ageEligibility';
import { del, post } from '../src/api/apiClient';
import { requestAccountDeletion, submitReport } from '../src/api/safetyService';
import legal from '../src/config/legal.json';
import serverLegal from '../server/safety/legal.json';

jest.mock('../src/api/apiClient', () => ({ post: jest.fn(), del: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('birthday and invalid calendar dates cannot bypass age validation', () => {
  const today = new Date(2026, 8, 28);
  expect(adultDateOfBirth('28/09/2008', today)).toBe('2008-09-28');
  expect(adultDateOfBirth('29/09/2008', today)).toBeNull();
  expect(adultDateOfBirth('31/02/2000', today)).toBeNull();
  expect(adultDateOfBirth('01/01/2027', today)).toBeNull();
  expect(adultDateOfBirth('29/02/2008', new Date(2026, 1, 28))).toBeNull();
  expect(adultDateOfBirth('29/02/2008', new Date(2026, 2, 1))).toBe(
    '2008-02-29',
  );
});
test('reports share only explicit details and identifiers', async () => {
  (post as jest.Mock).mockResolvedValue({ id: 'receipt', status: 'OPEN' });
  await submitReport(
    { profileId: 'p', chatId: 'c', messageId: 'm' },
    'Scam or fraud',
    '  Review this  ',
  );
  expect(post).toHaveBeenCalledWith('/profile-reports/', {
    reported_member: 'p',
    reason: 'Scam or fraud',
    details: 'Review this\nConversation: c\nMessage: m',
  });
});
test('failed or malformed responses never confirm deletion', async () => {
  (del as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(requestAccountDeletion()).rejects.toThrow('offline');
  (del as jest.Mock).mockResolvedValue({});
  await expect(requestAccountDeletion()).rejects.toThrow('did not confirm');
});
test('web and app publish identical policy versions and text', () => {
  expect(serverLegal).toEqual(legal);
});

test('deletion requires the backend scheduled-deletion acknowledgement', async () => {
  const response = { account_status: 'DELETION_PENDING', recovery_until: '2026-11-06T12:00:00Z' };
  (del as jest.Mock).mockResolvedValueOnce(response);
  expect(await requestAccountDeletion()).toEqual(response);
  expect(del).toHaveBeenCalledWith('/member-auth/account/delete/');
  (del as jest.Mock).mockResolvedValueOnce({ ...response, account_status: 'ACTIVE' });
  await expect(requestAccountDeletion()).rejects.toThrow('did not confirm');
});
