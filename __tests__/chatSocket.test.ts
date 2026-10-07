import { chatWsClient } from '../src/api/wsClient';
import { loadTokens } from '../src/utils/keychain';
jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn() }));
afterEach(() => {
  chatWsClient.disconnect();
  jest.restoreAllMocks();
});
test('leaving chat while credentials load does not open a stale socket', async () => {
  let resolve!: (value: any) => void;
  (loadTokens as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const constructor = jest.spyOn(global, 'WebSocket');
  const pending = chatWsClient.connect('old-chat', jest.fn());
  chatWsClient.disconnect();
  resolve({ accessToken: 'test' });
  await pending;
  expect(constructor).not.toHaveBeenCalled();
});
test('flat string message payload retains text and sender', async () => {
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'test' });
  const socket: any = { close: jest.fn(), readyState: 1, send: jest.fn() };
  jest.spyOn(global, 'WebSocket').mockImplementation(() => socket);
  const received = jest.fn();
  await chatWsClient.connect('chat', received);
  socket.onmessage({
    data: JSON.stringify({
      type: 'message',
      id: 'msg',
      message: 'hello',
      sender_id: 'other',
    }),
  });
  expect(received).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'msg', text: 'hello', senderId: 'other' }),
  );
  chatWsClient.disconnect();
  expect(socket.onclose).toBeNull();
});
