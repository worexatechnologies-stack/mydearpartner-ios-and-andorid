import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert, Linking, Modal, Platform, Text } from 'react-native';
import AppUpdateGate from '../src/components/AppUpdateGate';
import { get } from '../src/api/apiClient';
import { checkForUpdate, CURRENT_VERSION, showOptionalUpdateAlert } from '../src/utils/forceUpdate';
import { getStoreUrl } from '../src/utils/storeLinks';

jest.mock('../src/api/apiClient', () => ({ get: jest.fn() }));
const playUrl = 'https://play.google.com/store/apps/details?id=com.mydearpartner';
const appleUrl = 'https://apps.apple.com/in/app/my-dear-partner/id123456789';
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  (get as jest.Mock).mockResolvedValue({});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { Platform.OS = originalOS; jest.restoreAllMocks(); });

test('Android store fallback matches the native application ID', () => {
  expect(getStoreUrl()).toBe(playUrl);
  expect(getStoreUrl('https://play.google.com/store/apps/details?id=com.mydearpartner.app')).toBe(playUrl);
  expect(CURRENT_VERSION).toBe(require('../package.json').version);
});

test.each([
  'https://evil.test/id123456789',
  'https://apps.apple.com.evil.test/id123456789',
  'http://apps.apple.com/id123456789',
  'https://user:pass@apps.apple.com/id123456789',
  'https://apps.apple.com/app/id{APP_STORE_ID}',
  // eslint-disable-next-line no-script-url
  'javascript:alert(1)',
])('iOS rejects invalid or untrusted store configuration: %s', value => {
  Platform.OS = 'ios';
  expect(getStoreUrl(value)).toBeUndefined();
});

test('iOS uses the configured Apple listing and suppresses unconfigured prompts', async () => {
  Platform.OS = 'ios';
  (get as jest.Mock).mockResolvedValue({ min_version: '99.0.0', latest_version: '99.0.0', update_url: appleUrl });
  await expect(checkForUpdate()).resolves.toMatchObject({ updateRequired: true, updateUrl: appleUrl });
  showOptionalUpdateAlert('99.0.0');
  expect(Alert.alert).not.toHaveBeenCalled();
  showOptionalUpdateAlert('99.0.0', appleUrl);
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await buttons[1].onPress();
  expect(Linking.openURL).toHaveBeenCalledWith(appleUrl);
});

test('malformed remote versions and endpoint outages do not block launch', async () => {
  (get as jest.Mock).mockResolvedValue({ min_version: 99, latest_version: { version: '99.0.0' } });
  await expect(checkForUpdate()).resolves.toMatchObject({ updateRequired: false, updateAvailable: false });
  (get as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(checkForUpdate()).resolves.toMatchObject({ updateRequired: false, updateAvailable: false, updateUrl: playUrl });
});

test('mandatory update stays visible after opening the store and Android back', async () => {
  (get as jest.Mock).mockResolvedValue({ min_version: '99.0.0' });
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<AppUpdateGate><Text>App content</Text></AppUpdateGate>); });
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Update Now' }).props.onPress(); });
  expect(Linking.openURL).toHaveBeenCalledWith(playUrl);
  await act(async () => { tree.root.findByType(Modal).props.onRequestClose(); });
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => tree.unmount());
});

test('failed store opening leaves a visible retry action', async () => {
  (get as jest.Mock).mockResolvedValue({ min_version: '99.0.0' });
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error('unavailable'));
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<AppUpdateGate><Text>App content</Text></AppUpdateGate>); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Update Now' }).props.onPress(); });
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('Could not open the store');
  await act(async () => tree.unmount());
});
