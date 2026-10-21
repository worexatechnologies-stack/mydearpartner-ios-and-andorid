import { API_BASE_URL } from '../src/config/env';
import { getChats, getMessages, getMessagePage, markAsRead, sendMessage } from '../src/api/chatService';
import { get, post } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../src/utils/crypto', () => ({ smartDecryptText: jest.fn(async text => text ?? '') }));
beforeEach(() => jest.clearAllMocks());
test('send addresses the partner account instead of the conversation ID', async () => {
  (post as jest.Mock).mockResolvedValueOnce({ data: {
    id: 'saved', sender_id: 'me', text: 'prepared text',
    created_at: '2026-10-07T10:00:00Z',
  } });
  await expect(sendMessage('conversation', 'prepared text', 'partner-account'))
    .resolves.toEqual(expect.objectContaining({ id: 'saved' }));
  expect(post).toHaveBeenCalledWith('/conversations/partner-account/messages/', { text: 'prepared text' });
});
test('failed sends are not retried against another recipient', async () => {
  const error = { status: 404 };
  (post as jest.Mock).mockRejectedValueOnce(error);
  await expect(sendMessage('conversation', 'prepared text', 'partner-account')).rejects.toBe(error);
  expect(post).toHaveBeenCalledTimes(1);
});
test('malformed conversation and message rows do not crash list loading', async () => {
  (get as jest.Mock).mockResolvedValueOnce([null, {}, { id: 'chat', partner_id: 'partner', unread_count: '2' }]);
  await expect(getChats('me')).resolves.toEqual([expect.objectContaining({ id: 'chat', unreadCount: 2 })]);
  (get as jest.Mock).mockResolvedValueOnce([null, {}, { id: 'bad', sender_id: 'partner', created_at: 'invalid' }, { id: 'valid', sender_id: 'partner', text: 'Hello', created_at: '2026-10-05T10:00:00Z' }]);
  await expect(getMessages('chat', 'me', 'partner')).resolves.toEqual([expect.objectContaining({ id: 'valid', text: 'Hello' })]);
});
test('history outages do not trigger a second request to a different room URL', async () => {
  const error = { status: 500 };
  (get as jest.Mock).mockRejectedValueOnce(error);
  await expect(getMessages('chat', 'me', 'partner')).rejects.toBe(error);
  expect(get).toHaveBeenCalledTimes(1);
});
test('read receipt network failures do not fan out to alternate writes', async () => {
  (post as jest.Mock).mockRejectedValueOnce({ status: 0 });
  await markAsRead('chat', 'partner');
  expect(post).toHaveBeenCalledTimes(1);
});

const row = (id: string) => ({ id, sender_id: 'partner', text: id, created_at: '2026-10-19T10:00:00Z' });
test('reads next links from paginated history and follows the validated cursor', async () => {
  (get as jest.Mock).mockResolvedValueOnce({ results: [row('latest')], next: '?page=2' });
  const page = await getMessagePage('chat', 'me', 'partner');
  expect(page.messages.map(m => m.id)).toEqual(['latest']);
  expect(page.next).toBe(`${API_BASE_URL}/conversations/partner/messages/?page=2`);
  (get as jest.Mock).mockResolvedValueOnce({ data: { messages: [row('older')], next: null } });
  const older = await getMessagePage('chat', 'me', 'partner', page.next!);
  expect(get).toHaveBeenLastCalledWith(page.next);
  expect(older.messages.map(m => m.id)).toEqual(['older']);
  expect(older.next).toBeNull();
});
test.each(['https://untrusted.example/messages/?page=2', `${API_BASE_URL}/conversations/someone-else/messages/?page=2`])('rejects unsafe or different-conversation history links: %s', async cursor => {
  await expect(getMessagePage('chat', 'me', 'partner', cursor)).rejects.toThrow('Invalid message history link');
  expect(get).not.toHaveBeenCalled();
});
test('pagination preserves the fallback conversation route', async () => {
  (get as jest.Mock).mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({ messages: [row('latest')], next: '?cursor=older' });
  const page = await getMessagePage('chat', 'me', 'partner');
  expect(page.next).toBe(`${API_BASE_URL}/conversations/chat/messages/?cursor=older`);
  (get as jest.Mock).mockResolvedValueOnce({ messages: [row('older')], next: null });
  await getMessagePage('chat', 'me', 'partner', page.next!);
  expect(get).toHaveBeenLastCalledWith(page.next);
});
test('older page errors retain an error instead of pretending history ended', async () => {
  (get as jest.Mock).mockRejectedValueOnce({ status: 404 });
  await expect(getMessagePage('chat', 'me', 'partner', `${API_BASE_URL}/conversations/partner/messages/?page=2`)).rejects.toMatchObject({ status: 404 });
  expect(get).toHaveBeenCalledTimes(1);
});
