import { privacySettingsService } from '../src/api/settingsService';
import { get, patch } from '../src/api/apiClient';
import { handleRealtimeNotification } from '../src/services/NotificationRealtimeService';
import { DeviceEventEmitter } from 'react-native';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), patch: jest.fn() }));

test('privacy loads from the server and saves only the changed field', async () => {
  (get as jest.Mock).mockResolvedValue({ show_online_status: false, contact_visibility: 'none' });
  expect(await privacySettingsService.get()).toEqual({ show_online_status: false, contact_visibility: 'none' });
  (patch as jest.Mock).mockResolvedValue({ show_online_status: true, contact_visibility: 'HIDDEN' });
  await privacySettingsService.update({ show_online_status: true });
  expect(patch).toHaveBeenCalledWith('/member-auth/privacy-settings/', { show_online_status: true });
});

test('privacy maps production enums in both directions', async () => {
  (get as jest.Mock).mockResolvedValue({ show_online_status: false, contact_visibility: 'ALL', photo_visibility: 'APPROVED_MEMBERS' });
  expect(await privacySettingsService.get()).toEqual({ show_online_status: false, contact_visibility: 'everyone', photo_visibility: 'approved' });
  (patch as jest.Mock).mockResolvedValue({ show_online_status: false, contact_visibility: 'CONNECTED_ONLY', photo_visibility: 'CONNECTED_ONLY' });
  await privacySettingsService.update({ contact_visibility: 'matches', photo_visibility: 'matches' });
  expect(patch).toHaveBeenLastCalledWith('/member-auth/privacy-settings/', { contact_visibility: 'CONNECTED_ONLY', photo_visibility: 'CONNECTED_ONLY' });
});

test('an ignored privacy write is rejected', async () => {
  (patch as jest.Mock).mockResolvedValue({ show_online_status: true, contact_visibility: 'ALL' });
  await expect(privacySettingsService.update({ contact_visibility: 'none' })).rejects.toThrow('did not save');
});

test('other devices refresh settings after a privacy event', async () => {
  const listener = jest.fn();
  const subscription = DeviceEventEmitter.addListener('PRIVACY_SETTINGS_CHANGED', listener);
  await handleRealtimeNotification({ type: 'privacy.updated' });
  expect(listener).toHaveBeenCalledTimes(1);
  subscription.remove();
});
