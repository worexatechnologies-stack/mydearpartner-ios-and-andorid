import { settingsService } from '../src/api/settingsService';
import { get, patch } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), patch: jest.fn() }));

test('loads production settings without losing false values', async () => {
  (get as jest.Mock).mockResolvedValue({ incognito: false, push_notifications: true, email_notifications: false });
  expect(await settingsService.getSettings()).toEqual({ incognitoMode: false, pushNotifications: true, emailNotifications: false });
});

test('sends only changed settings using the production field names', async () => {
  (patch as jest.Mock).mockResolvedValue({ incognito: true, push_notifications: false, email_notifications: true });
  await settingsService.updateSettings({ incognitoMode: true, pushNotifications: false });
  expect(patch).toHaveBeenCalledWith('/settings/', { incognito: true, push_notifications: false });
});

test('rejects ignored writes and incomplete settings responses', async () => {
  (patch as jest.Mock).mockResolvedValue({ incognito: false, push_notifications: true, email_notifications: true });
  await expect(settingsService.updateSettings({ incognitoMode: true })).rejects.toThrow('did not save');
  (get as jest.Mock).mockResolvedValue({});
  await expect(settingsService.getSettings()).rejects.toThrow('valid account settings');
});
