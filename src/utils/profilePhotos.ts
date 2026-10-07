import { MEDIA_BASE_URL } from '../config/env';

export interface ProfilePhotoRecord {
  id: string;
  uri: string;
  isPrimary: boolean;
}

export function resolveProfilePhotoUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), `${new URL(MEDIA_BASE_URL).origin}/`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeProfilePhoto(value: unknown): ProfilePhotoRecord | null {
  if (!value || typeof value !== 'object') return null;
  const photo = value as Record<string, unknown>;
  const uri = resolveProfilePhotoUrl(photo.image_url || photo.url);
  if (!uri || photo.id == null || !String(photo.id)) return null;
  return { id: String(photo.id), uri, isPrimary: photo.is_primary === true };
}
