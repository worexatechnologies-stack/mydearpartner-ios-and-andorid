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

/**
 * Standard image picker options configured for universal iPhone & Android support:
 * - assetRepresentationMode: 'compatible' instructs iOS to transcode HEIC/HEIF photos to JPEG
 * - maxWidth / maxHeight: 1600 scales down large 48MP phone captures to prevent upload timeouts
 * - quality: 0.8 balances crystal clarity with fast mobile upload speeds
 */
export const COMPATIBLE_IMAGE_PICKER_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.8 as const,
  maxWidth: 1600,
  maxHeight: 1600,
  assetRepresentationMode: 'compatible' as const,
  selectionLimit: 1,
};

export const COMPATIBLE_CAMERA_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.8 as const,
  maxWidth: 1600,
  maxHeight: 1600,
  cameraType: 'front' as const,
  assetRepresentationMode: 'compatible' as const,
};

/**
 * Normalizes photo upload metadata for full cross-platform & iPhone HEIC/HEIF compatibility.
 * Replaces .heic/.heif extensions and mime types with standard image/jpeg.
 */
export function sanitizePhotoUpload(
  fileName?: string | null,
  mimeType?: string | null,
): { fileName: string; mimeType: string } {
  let name = fileName?.trim() || `photo-${Date.now()}.jpg`;
  let type = mimeType?.trim().toLowerCase() || 'image/jpeg';

  // iPhone HEIC / HEIF format normalization to standard JPEG
  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    /\.(heic|heif)$/i.test(name)
  ) {
    name = name.replace(/\.(heic|heif)$/i, '.jpg');
    type = 'image/jpeg';
  }

  // Ensure standard photo extension if missing
  if (!/\.(jpg|jpeg|png|webp)$/i.test(name)) {
    name = `${name}.jpg`;
  }

  return { fileName: name, mimeType: type };
}

