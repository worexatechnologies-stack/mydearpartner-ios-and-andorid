/**
 * MyDearPartner — Profile Service
 *
 * Connects to Django profile endpoints.
 * Backend: https://mydearpartner.in/api/v1/
 *
 * Expected URL patterns:
 *   GET    /api/v1/profile/me/          → BackendProfile (own profile)
 *   PATCH  /api/v1/profile/me/          → BackendProfile (update)
 *   GET    /api/v1/profiles/            → PaginatedResponse<BackendProfile> (discover)
 *   GET    /api/v1/profiles/{id}/       → BackendProfile
 *   POST   /api/v1/profile/photo/       → { photo_url } (multipart upload)
 *   DELETE /api/v1/profile/photo/{id}/  → 204
 */

import { Profile } from '../types/models';
import { websiteProfileFields } from '../utils/websiteProfileForm';
import { ProfilePhotoRecord, normalizeProfilePhoto, resolveProfilePhotoUrl, sanitizePhotoUpload } from '../utils/profilePhotos';
import { del,get,patch,upload } from './apiClient';
import { BackendProfile,ProfileUpdatePayload,SearchFilters } from './types';

const profileText = (value: unknown): string => typeof value === 'string' ? value : '';

/** Map Django snake_case profile to iOS camelCase Profile */
export function mapProfile(bp: BackendProfile): Profile {
  // B7: Guard against null/incomplete responses — log and return safe defaults
  // instead of throwing, which would crash the entire list render.
  if (!bp || typeof bp !== 'object' || !bp.id) {
    // Return a minimal sentinel so callers can filter with `.filter(p => p.id)`
    return { id: '', name: '', age: 0, gender: 'other', city: '', religion: '',
      profession: '', education: '', height: '', about: '', photo: '', interests: [] } as Profile;
  }
  const resolvePhoto = resolveProfilePhotoUrl;
  const primaryPhoto = normalizeProfilePhoto(bp.primary_photo);

  let finalCity =
    bp.city ??
    bp.current_city ??
    bp.work_location ??
    (bp as any).location?.city ??
    (bp as any).address?.city ??
    (bp as any).residence ??
    '';
  let finalState =
    bp.state ?? (bp as any).location?.state ?? (bp as any).address?.state ?? '';

  finalCity = profileText(finalCity);
  finalState = profileText(finalState);
  if (!finalCity && typeof (bp as any).location === 'string')
    finalCity = (bp as any).location;

  // Backend returns premium data inside active_membership object
  const activeMembership = (bp as any).active_membership;
  const planSlug =
    activeMembership?.plan_slug ??
    bp.current_plan_slug ??
    (bp as any).plan_slug ??
    'free';
  // A historical/expired plan name is not entitlement. Prefer the explicit
  // active flag returned with the membership; retain legacy is_premium only
  // for servers that do not yet return a membership object.
  // An active free trial/free membership is still a free account. Premium is
  // granted only by an explicit active *non-free* membership from the server.
  // Do not infer entitlement from a marketing plan name or legacy flag.
  const isPremium =
    activeMembership?.is_active === true &&
    planSlug !== 'free' &&
    planSlug !== '' &&
    planSlug != null;
  const contactUnlocks =
    (bp as any).contact_unlocks ??
    activeMembership?.contact_unlocks ?? activeMembership?.limits?.contact_unlocks;

  // Trust and personal attributes must come from the member/backend.
  const managedBy = bp.managed_by;
  const badges = bp.verification_badges;
  const lifestyle = bp.lifestyle;

  return {
    websiteFields: Object.fromEntries(websiteProfileFields.flatMap(({ key }) => {
      const value = (bp as unknown as Record<string, unknown>)[key];
      return typeof value === 'string' || typeof value === 'number' || value === null ||
        (Array.isArray(value) && value.every(item => typeof item === 'string')) ? [[key, value]] : [];
    })),
    id: String(bp.id),
    userId: profileText(bp.user_id) || profileText((bp as any).user) || String(bp.id),
    name:
      profileText(bp.name) ||
      profileText(bp.full_name) ||
      [profileText(bp.first_name), profileText(bp.last_name)].filter(Boolean).join(' '),
    age: Number.isFinite(Number(bp.age)) ? Number(bp.age) : 0,
    gender: (String(bp.gender || 'other').toLowerCase()) as Profile['gender'],
    city: finalCity,
    state: finalState,
    religion: profileText(bp.religion ?? ''),
    profession: profileText(bp.occupation ?? bp.profession ?? ''),
    company: bp.company,
    education: profileText(bp.highest_education ?? bp.education ?? ''),
    height: profileText(bp.height ?? ''),
    about: profileText(bp.about ?? bp.about_me ?? ''),
    // Handle backend returning array of strings or array of objects for photos
    photo: primaryPhoto?.uri || resolvePhoto(bp.primary_photo) ||
      resolvePhoto(bp.primary_photo?.image_url || bp.primary_photo?.url) || resolvePhoto(bp.photo) || (Array.isArray(bp.photos) && bp.photos.length
      ? resolvePhoto(typeof bp.photos[0] === 'string' ? bp.photos[0] : bp.photos[0]?.image_url || bp.photos[0]?.url || '')
      : ''),
    photoIds: Object.fromEntries([
      ...(primaryPhoto ? [[primaryPhoto.uri, primaryPhoto.id]] : []),
      ...(bp.photo_id != null && bp.photo ? [[resolvePhoto(bp.photo), String(bp.photo_id)]] : []),
      ...(Array.isArray(bp.photos) ? bp.photos : []).flatMap(p => {
        if (!p || typeof p === 'string' || p.id == null) return [];
        const url = resolvePhoto(p.image_url || p.url || '');
        return url ? [[url, String(p.id)]] : [];
      }),
    ]),
    photos: Array.isArray(bp.photos)
      ? bp.photos.map(p =>
          typeof p === 'string'
            ? resolvePhoto(p)
            : resolvePhoto(p?.image_url || p?.url || ''),
        )
      : [],
    interests: Array.isArray(bp.hobbies ?? bp.interests)
      ? (bp.hobbies ?? bp.interests ?? []).filter(item => typeof item === 'string') : [],
    prompts: Array.isArray((bp as any).prompts) ? (bp as any).prompts : [],
    compatibilityScore: bp.compatibility ?? bp.compatibility_score,
    isVerified: bp.is_verified,
    isOnline: bp.is_online,
    diet: bp.diet,
    income: bp.annual_income ?? bp.income,
    motherTongue: bp.mother_tongue ?? bp.motherTongue,
    horoscope: bp.horoscope,
    maritalStatus: bp.marital_status ?? bp.maritalStatus,
    email: bp.email,
    mobileNumber: bp.mobile_number ?? bp.mobileNumber ?? (bp as any).mobile ?? (bp as any).phone,
    caste: bp.caste,
    subCaste: bp.sub_caste ?? bp.subCaste,
    gothra: bp.gothra,
    starNakshatra: bp.star_nakshatra ?? bp.starNakshatra,
    manglikStatus: bp.manglik_status ?? bp.manglikStatus,
    bloodGroup: bp.blood_group ?? bp.bloodGroup,
    complexion: bp.complexion,
    weight: bp.weight,
    fatherStatus: bp.father_status ?? bp.fatherStatus,
    motherStatus: bp.mother_status ?? bp.motherStatus,
    familyType: bp.family_type ?? bp.familyType,
    familyStatus: bp.family_status ?? bp.familyStatus,
    familyLocation: bp.family_location ?? bp.familyLocation,
    isPremium,
    currentPlanSlug: planSlug,
    contactUnlocks,
    activeMembership: activeMembership || undefined,
    managedBy: ['Self', 'Parent', 'Sibling', 'Relative'].includes(managedBy ?? '')
      ? managedBy : undefined,
    verificationBadges: Array.isArray(badges)
      ? badges.filter(badge => ['id', 'education', 'employment'].includes(badge)) : [],
    lifestyle: lifestyle && typeof lifestyle === 'object' ? {
      diet: typeof lifestyle.diet === 'string' ? lifestyle.diet : undefined,
      smoking: typeof lifestyle.smoking === 'string' ? lifestyle.smoking : undefined,
      drinking: typeof lifestyle.drinking === 'string' ? lifestyle.drinking : undefined,
      livingArrangement: typeof lifestyle.living_arrangement === 'string' ? lifestyle.living_arrangement : undefined,
    } : undefined,
  };
}

/**
 * Get the current user's own profile.
 * Backend /auth/me/ returns { data: { user: {...} } } structure.
 */
export async function getMyProfile(): Promise<Profile> {
  const res = await get<any>('/auth/me/');
  // Handle both envelope { data: { user: {} } } and flat { id, ... } shapes
  const profile = res?.user ?? res?.data?.user ?? res?.data ?? res;
  const mapped = mapProfile(profile);
  if (!mapped.id) throw new Error('Could not load your profile. Please try again.');
  return mapped;
}

/**
 * Update the current user's profile.
 */
export async function updateMyProfile(
  payload: ProfileUpdatePayload,
): Promise<Profile> {
  const currentPayload: Record<string, any> = { ...payload };

  // Send the website's supported wire names once. Keep explicit empty values
  // so clearing a field also reaches the shared database.
  const aliases: Record<string, string> = {
    city: 'work_location', current_city: 'work_location',
    profession: 'occupation', education: 'highest_education',
    about_me: 'about', interests: 'hobbies', income: 'annual_income',
    mobile: 'mobile_number', phone: 'mobile_number',
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (currentPayload[canonical] === undefined && currentPayload[alias] !== undefined) {
      currentPayload[canonical] = currentPayload[alias];
    }
    delete currentPayload[alias];
  }

  if (currentPayload.name !== undefined && currentPayload.first_name === undefined) {
    const parts = String(currentPayload.name).trim().split(/\s+/);
    currentPayload.first_name = parts[0];
    currentPayload.last_name = parts.slice(1).join(' ');
  }

  delete currentPayload.name;
  // Never discard a rejected member edit and report a successful save.
  await patch<BackendProfile>('/auth/me/', currentPayload as ProfileUpdatePayload);
  const saved = await getMyProfile();
  for (const key of ['state', 'religion'] as const) {
    if (payload[key] !== undefined && saved[key] !== payload[key]) {
      throw new Error(`Your ${key} was not saved by the website. Please try again or contact support.`);
    }
  }
  return saved;
}

/**
 * Get the discover feed (paginated profiles, excluding own).
 */
export async function getDiscoverProfiles(filters?: SearchFilters): Promise<{
  profiles: Profile[];
  count: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (filters?.gender && filters.gender !== 'all')
    params.set('gender', filters.gender);
  if (filters?.min_age) params.set('min_age', String(filters.min_age));
  if (filters?.max_age) params.set('max_age', String(filters.max_age));
  if (filters?.city && filters.city !== 'All') params.set('city', filters.city);
  if (filters?.religion && filters.religion !== 'All')
    params.set('religion', filters.religion);
  if (filters?.profession && filters.profession !== 'All')
    params.set('profession', filters.profession);
  if (filters?.verified_only) params.set('verified_only', 'true');
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  params.set('page_size', String(filters?.page_size ?? 100));

  const query = params.toString();
  const endpoint = `/profiles/${query ? `?${query}` : ''}`;
  const data = await get<any>(endpoint);

  // Handle both paginated DRF response and plain array
  let results: BackendProfile[] = [];
  let count = 0;
  let hasMore = false;

  if (Array.isArray(data)) {
    results = data;
    count = data.length;
  } else if (data && typeof data === 'object') {
    results = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.data)
      ? data.data
      : [];
    count = typeof data.count === 'number' ? data.count : results.length;
    hasMore = Boolean(data.next);
  }

  // If there are more profiles and page wasn't restricted, fetch next page to gather all profiles
  if (hasMore && !filters?.page && data?.next) {
    try {
      params.set('page', '2');
      const page2Data = await get<any>(`/profiles/?${params.toString()}`);
      const page2Results: BackendProfile[] = Array.isArray(page2Data?.results)
        ? page2Data.results
        : Array.isArray(page2Data?.data)
        ? page2Data.data
        : [];
      if (page2Results.length > 0) {
        results = [...results, ...page2Results];
      }
    } catch {
      // Ignore secondary page failures
    }
  }

  return {
    profiles: Array.from(new Map(results.map(mapProfile).filter(p => p.id !== '')
      .map(profile => [profile.id, profile])).values()),
    count,
    hasMore,
  };
}

/**
 * Get a specific profile by ID.
 */
export async function getProfileById(id: string): Promise<Profile> {
  const response = await get<any>(`/profiles/${encodeURIComponent(id)}/`);
  // Deployments may wrap the detail in data, profile, or member. Unwrap
  // before mapping; mapProfile's list sentinel must never become a detail.
  const data = response?.data ?? response;
  const detail = data?.profile ?? data?.member ?? data?.user ?? data;
  const profile = mapProfile(detail);
  if (!profile.id || !profile.name.trim()) {
    throw new Error('Could not load this profile. Please try again.');
  }
  return profile;
}

/**
 * Upload a profile photo.
 * @param photoUri - local file URI from image picker
 * @param fileName - original file name
 * @param mimeType - e.g. 'image/jpeg'
 */
export async function uploadPhoto(
  photoUri: string,
  fileName: string,
  mimeType: string,
): Promise<ProfilePhotoRecord> {
  const { Platform } = require('react-native');
  // On Android, FormData needs file:// for absolute paths
  let normalizedUri = photoUri;
  if (
    Platform.OS === 'android' &&
    !normalizedUri.startsWith('file://') &&
    !normalizedUri.startsWith('content://')
  ) {
    normalizedUri = `file://${normalizedUri}`;
  }

  const { fileName: safeFileName, mimeType: safeMimeType } = sanitizePhotoUpload(
    fileName,
    mimeType,
  );

  const formData = new FormData();
  formData.append('photo', {
    uri: normalizedUri,
    name: safeFileName,
    type: safeMimeType,
  } as any);

  const data = await upload<unknown>(
    '/profile-photos/',
    formData,
    'POST',
  );
  const photo = normalizeProfilePhoto(data);
  if (!photo) throw new Error('The server did not return the uploaded photo. Reload your gallery before trying again.');
  return photo;
}

export async function getMyPhotos(): Promise<{ photos: ProfilePhotoRecord[]; maxPhotos: number }> {
  const data = await get<{ photos: unknown[]; max_photos: number }>('/profile-photos/mine/');
  if (!Array.isArray(data?.photos)) throw new Error('Invalid gallery response.');
  const photos = data.photos.map(normalizeProfilePhoto);
  if (photos.some(photo => !photo)) throw new Error('The server returned incomplete photo records.');
  return {
    photos: photos as ProfilePhotoRecord[],
    maxPhotos: Number.isInteger(data.max_photos) && data.max_photos >= 0 ? data.max_photos : 5,
  };
}

/**
 * Delete a profile photo by ID/index.
 */
export async function deletePhoto(photoId: string): Promise<{ primary_photo_id?: string | null }> {
  return await del(`/profile-photos/${encodeURIComponent(photoId)}/`);
}
