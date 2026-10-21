import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import notifee from '@notifee/react-native';
import NotificationDiagnosticsCard from '../src/components/NotificationDiagnosticsCard';
import AppButton from '../src/components/AppButton';
import { readNotificationDiagnostics } from '../src/services/NotificationDiagnostics';

jest.mock('../src/services/NotificationDiagnostics', () => ({
  ...jest.requireActual('../src/services/NotificationDiagnostics'),
  readNotificationDiagnostics: jest.fn(),
}));
jest.mock('../src/services/PushNotificationService', () => ({
  CHANNEL_ID_MESSAGES: 'mdp_messages_v2',
  registerWithBackend: jest.fn(), requestPermissionAndGetToken: jest.fn(),
}));
jest.mock('@notifee/react-native', () => ({ __esModule: true, default: {
  openNotificationSettings: jest.fn().mockResolvedValue(undefined),
} }));
let tree: Renderer.ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); });

test('disabled chat guidance opens the chat channel settings directly', async () => {
  (readNotificationDiagnostics as jest.Mock).mockResolvedValue({ permission: 'enabled', messages: 'disabled', interests: 'enabled', deviceToken: true, registration: 'registered' });
  await act(async () => { tree = Renderer.create(<NotificationDiagnosticsCard />); });
  const button = tree.root.findAllByType(AppButton).find(node => node.props.title === 'Open chat notification settings');
  expect(button).toBeDefined();
  await act(async () => button!.props.onPress());
  expect(notifee.openNotificationSettings).toHaveBeenCalledWith('mdp_messages_v2');
});

test('reconnect guidance has one reconnect action', async () => {
  (readNotificationDiagnostics as jest.Mock).mockResolvedValue({ permission: 'enabled', messages: 'enabled', interests: 'enabled', deviceToken: false, registration: 'failed' });
  await act(async () => { tree = Renderer.create(<NotificationDiagnosticsCard />); });
  expect(tree.root.findAllByType(AppButton).filter(node => /Reconnect/.test(node.props.title))).toHaveLength(1);
});
