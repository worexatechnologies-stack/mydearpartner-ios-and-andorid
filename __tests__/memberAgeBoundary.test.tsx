import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import MemberAgeBoundary from '../src/components/MemberAgeBoundary';
import { get } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'member' }, logout: jest.fn() }) }));
beforeEach(() => { jest.clearAllMocks(); (get as jest.Mock).mockReset(); });
test.each([
  ['1990-01-01', true], ['2020-01-01', false], [null, false], ['1990-02-31', false],
])('member content requires a valid recorded adult DOB: %s', async (dob, allowed) => {
  (get as jest.Mock).mockResolvedValue({ id: 'member', date_of_birth: dob });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<MemberAgeBoundary><Text testID="member-content">Profiles</Text></MemberAgeBoundary>); });
  expect(tree.root.findAllByProps({ testID: 'member-content' }).length > 0).toBe(allowed);
  expect(get).toHaveBeenCalledWith('/auth/me/');
  await act(async () => tree.unmount());
});
