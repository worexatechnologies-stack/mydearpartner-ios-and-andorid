import { get,patch } from './apiClient';

export interface UserSettings {
  incognitoMode: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
}

export const settingsService = {
  getSettings: (): Promise<UserSettings> => get<UserSettings>('/settings/'),
  updateSettings: (updates: Partial<UserSettings>): Promise<UserSettings> =>
    patch<UserSettings>('/settings/', updates),
};

export interface PrivacySettings {
  show_online_status: boolean;
  contact_visibility: 'everyone' | 'matches' | 'none';
  photo_visibility?: 'everyone' | 'matches' | 'blurred';
}

export const privacySettingsService = {
  get: (): Promise<PrivacySettings> => get('/member-auth/privacy-settings/'),
  update: (updates: Partial<PrivacySettings>): Promise<PrivacySettings> =>
    patch('/member-auth/privacy-settings/', updates),
};
