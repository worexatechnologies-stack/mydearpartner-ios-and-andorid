import { get,patch } from './apiClient';

export interface UserSettings {
  incognitoMode: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
}

export const settingsService = {
  getSettings: async (): Promise<UserSettings> => readSettings(await get('/settings/')),
  updateSettings: async (updates: Partial<UserSettings>): Promise<UserSettings> => {
    const wire: Record<string, boolean> = {};
    if (updates.incognitoMode !== undefined) wire.incognito = updates.incognitoMode;
    if (updates.pushNotifications !== undefined) wire.push_notifications = updates.pushNotifications;
    if (updates.emailNotifications !== undefined) wire.email_notifications = updates.emailNotifications;
    const saved = readSettings(await patch('/settings/', wire));
    confirmSaved(updates, saved);
    return saved;
  },
};

function readSettings(value: any): UserSettings {
  const result = {
    incognitoMode: value?.incognito ?? value?.is_hidden ?? value?.incognitoMode,
    pushNotifications: value?.push_notifications ?? value?.pushNotifications,
    emailNotifications: value?.email_notifications ?? value?.emailNotifications,
  };
  if (Object.values(result).some(item => typeof item !== 'boolean')) {
    throw new Error('The service did not return valid account settings.');
  }
  return result;
}

function confirmSaved<T extends object>(updates: Partial<T>, saved: T): void {
  for (const key of Object.keys(updates) as (keyof T)[]) {
    if (updates[key] !== undefined && saved[key] !== updates[key]) {
      throw new Error('The service did not save your settings. Please try again.');
    }
  }
}

export interface PrivacySettings {
  show_online_status: boolean;
  contact_visibility: 'everyone' | 'matches' | 'none';
  photo_visibility?: 'everyone' | 'matches' | 'approved';
}

const contactWire = { everyone: 'ALL', matches: 'CONNECTED_ONLY', none: 'HIDDEN' };
const photoWire = { everyone: 'ALL', matches: 'CONNECTED_ONLY', approved: 'APPROVED_MEMBERS' };

function readPrivacy(value: any): PrivacySettings {
  const contact = Object.entries(contactWire).find(([key, wire]) =>
    value?.contact_visibility === key || value?.contact_visibility === wire)?.[0];
  const photo = Object.entries(photoWire).find(([key, wire]) =>
    value?.photo_visibility === key || value?.photo_visibility === wire)?.[0];
  if (typeof value?.show_online_status !== 'boolean' || !contact ||
      (value?.photo_visibility !== undefined && !photo)) {
    throw new Error('The service did not return valid privacy settings.');
  }
  return {
    show_online_status: value.show_online_status,
    contact_visibility: contact as PrivacySettings['contact_visibility'],
    ...(photo ? { photo_visibility: photo as PrivacySettings['photo_visibility'] } : {}),
  };
}

export const privacySettingsService = {
  get: async (): Promise<PrivacySettings> => readPrivacy(await get('/member-auth/privacy-settings/')),
  update: async (updates: Partial<PrivacySettings>): Promise<PrivacySettings> => {
    const wire = {
      ...updates,
      ...(updates.contact_visibility !== undefined ? { contact_visibility: contactWire[updates.contact_visibility] } : {}),
      ...(updates.photo_visibility !== undefined ? { photo_visibility: photoWire[updates.photo_visibility] } : {}),
    };
    const saved = readPrivacy(await patch('/member-auth/privacy-settings/', wire));
    confirmSaved(updates, saved);
    return saved;
  },
};
