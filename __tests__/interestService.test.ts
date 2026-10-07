jest.mock('../src/api/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  del: jest.fn(),
  patch: jest.fn(),
}));

import { get, post, del, patch } from '../src/api/apiClient';
import {
  sendInterest,
  cancelInterest,
  respondToInterest,
} from '../src/api/interestService';

const mockedGet = get as jest.MockedFunction<typeof get>;
const mockedPost = post as jest.MockedFunction<typeof post>;
const mockedDel = del as jest.MockedFunction<typeof del>;
const mockedPatch = patch as jest.MockedFunction<typeof patch>;

describe('interest service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends interest successfully', async () => {
    mockedPost.mockResolvedValueOnce({
      id: 'int_101',
      sender: { id: 'usr_me', name: 'Me' },
      receiver: { id: 'usr_partner', name: 'Partner' },
      status: 'PENDING',
      created_at: '2026-09-24T10:00:00Z',
    });

    const res = await sendInterest('prof_partner', 'usr_partner');
    expect(res.id).toBe('int_101');
    expect(res.status).toBe('pending');
    expect(mockedPost).toHaveBeenCalledWith('/interests/', {
      receiver_id: 'usr_partner',
    });
  });

  it('cancels interest via DELETE endpoint', async () => {
    mockedDel.mockResolvedValueOnce({});
    await cancelInterest('int_101');
    expect(mockedDel).toHaveBeenCalledWith('/interests/int_101/');
  });

  it('responds to interest (accept) via PATCH endpoint', async () => {
    mockedPatch.mockResolvedValueOnce({
      id: 'int_101',
      sender: { id: 'usr_partner' },
      receiver: { id: 'usr_me' },
      status: 'ACCEPTED',
      created_at: '2026-09-24T10:00:00Z',
    });

    const res = await respondToInterest('int_101', 'accepted');
    expect(res.id).toBe('int_101');
    expect(res.status).toBe('accepted');
    expect(mockedPatch).toHaveBeenCalledWith('/interests/int_101/', {
      status: 'ACCEPTED',
    });
  });

  it('falls back to accepting incoming interest if backend says already exists', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Interest already exists'));
    // getSentInterests returns empty
    mockedGet.mockResolvedValueOnce([]);
    // getReceivedInterests returns incoming interest from partner
    mockedGet.mockResolvedValueOnce([
      {
        id: 'int_incoming',
        sender: { id: 'usr_partner' },
        receiver: { id: 'usr_me' },
        status: 'PENDING',
        created_at: '2026-09-24T10:00:00Z',
      },
    ]);
    // respondToInterest patch
    mockedPatch.mockResolvedValueOnce({
      id: 'int_incoming',
      sender: { id: 'usr_partner' },
      receiver: { id: 'usr_me' },
      status: 'ACCEPTED',
    });

    const res = await sendInterest('usr_partner');
    expect(res.id).toBe('int_incoming');
    expect(res.status).toBe('accepted');
    expect(mockedPatch).toHaveBeenCalledWith('/interests/int_incoming/', {
      status: 'ACCEPTED',
    });
  });
});


beforeEach(() => jest.clearAllMocks());

test.each([0, 401, 403, 429, 500, 502])('send failure %s does not replay a mutation using a different identifier', async status => {
  const error = { status, message: 'Request failed' };
  mockedPost.mockRejectedValueOnce(error);
  await expect(sendInterest('profile-partner', 'member-partner')).rejects.toBe(error);
  expect(mockedPost).toHaveBeenCalledTimes(1);
});
test.each([0, 401, 403, 429, 500])('cancel failure %s does not attempt alternate writes', async status => {
  const error = { status, message: 'Request failed' };
  mockedDel.mockRejectedValueOnce(error);
  await expect(cancelInterest('interest')).rejects.toBe(error);
  expect(mockedPatch).not.toHaveBeenCalled();
  expect(mockedPost).not.toHaveBeenCalled();
});


test('malformed interest list rows are omitted without crashing the activity feed', async () => {
  mockedGet.mockResolvedValueOnce([null, {}, { id: 'valid', status: 'PENDING', sender: { id: 'partner' }, receiver: { id: 'self' } }]);
  const { getReceivedInterests } = require('../src/api/interestService');
  await expect(getReceivedInterests()).resolves.toEqual([expect.objectContaining({ id: 'valid' })]);
});
