import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { readNotificationDiagnostics } from '../src/services/NotificationDiagnostics';
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getNotificationSettings: jest.fn(), getChannel: jest.fn() },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
}));
jest.mock('../src/services/PushNotificationService', () => ({
  CHANNEL_ID_MESSAGES: 'messages', CHANNEL_ID_INTERESTS: 'interests',
  getPushRegistrationStatus: () => 'failed', getDeviceToken: () => 'secret-token',
}));
const os = Platform.OS;
afterEach(() => { Platform.OS = os; jest.clearAllMocks(); });
test('distinguishes disabled chat channel from enabled interests and backend failure', async () => {
  Platform.OS = 'android';
  (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: 1 });
  (notifee.getChannel as jest.Mock).mockImplementation(async id => ({ blocked: id === 'messages', importance: 4 }));
  const result = await readNotificationDiagnostics();
  expect(result).toMatchObject({ permission: 'enabled', messages: 'disabled', interests: 'enabled', deviceToken: true, registration: 'failed' });
  expect(JSON.stringify(result)).not.toContain('secret-token');
});
test('unavailable native settings remain unknown instead of enabled', async () => {
  Platform.OS = 'android';
  (notifee.getNotificationSettings as jest.Mock).mockRejectedValue(new Error('Unavailable'));
  (notifee.getChannel as jest.Mock).mockRejectedValue(new Error('Unavailable'));
  expect(await readNotificationDiagnostics()).toMatchObject({ permission: 'unknown', messages: 'unknown' });
});
test('iOS uses system settings and reports provisional permissions', async () => {
  Platform.OS = 'ios';
  (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: 2 });
  expect(await readNotificationDiagnostics()).toMatchObject({ permission: 'provisional', messages: 'system' });
  expect(notifee.getChannel).not.toHaveBeenCalled();
});

test('guidance prioritizes disabled chat alerts over enabled interests', () => {
  const { notificationNextStep } = require('../src/services/NotificationDiagnostics');
  expect(notificationNextStep({ permission: 'enabled', messages: 'disabled', interests: 'enabled', deviceToken: true, registration: 'registered' }))
    .toMatchObject({ action: 'messages', title: 'Chat alerts are turned off' });
});
test('ready local settings do not claim that a notification arrived', () => {
  const { notificationNextStep } = require('../src/services/NotificationDiagnostics');
  const ready = notificationNextStep({ permission: 'enabled', messages: 'enabled', interests: 'enabled', deviceToken: true, registration: 'registered' });
  expect(ready.action).toBe('none');
  expect(ready.body).toContain('To check delivery');
});
test('unconfirmed registration offers reconnect rather than a ready label', () => {
  const { notificationNextStep } = require('../src/services/NotificationDiagnostics');
  expect(notificationNextStep({ permission: 'enabled', messages: 'enabled', interests: 'enabled', deviceToken: true, registration: 'unknown' }).action).toBe('reconnect');
});
