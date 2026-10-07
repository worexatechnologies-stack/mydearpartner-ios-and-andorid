import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';
import AuthImage from '../src/components/AuthImage';
import { get } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn() }));
jest.mock('../src/utils/keychain', () => ({ currentAccessToken: 'test-token' }));
let tree: ReactTestRenderer;
const profilePhoto = () => tree.root.findAllByType(Image).filter(image => image.props.source?.uri)[0];
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); });

test('failed private images can refresh the session and retry the same URL', async () => {
  (get as jest.Mock).mockResolvedValue({ id: 'member' });
  await act(async () => { tree = create(<AuthImage source={{ uri: 'https://mydearpartner.in/api/photo/' }} showLoading fallbackLabel="Photo unavailable" />); });
  await act(async () => { profilePhoto().props.onError({ nativeEvent: { error: '401' } }); });
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => { await tree.root.findAllByProps({ accessibilityLabel: 'Retry profile photo' })[0].props.onPress(); });
  expect(get).toHaveBeenCalledWith('/auth/me/');
  expect(profilePhoto().props.source.headers.Authorization).toBe('Bearer test-token');
});

test('offline retry keeps the retry control available', async () => {
  (get as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { tree = create(<AuthImage source={{ uri: 'https://mydearpartner.in/api/photo/' }} showLoading />); });
  await act(async () => { profilePhoto().props.onError({ nativeEvent: { error: 'offline' } }); });
  await act(async () => { await tree.root.findAllByProps({ accessibilityLabel: 'Retry profile photo' })[0].props.onPress(); });
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Retry profile photo' })[0].props.disabled).toBe(false);
});
