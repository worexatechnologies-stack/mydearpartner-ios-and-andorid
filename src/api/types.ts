/**
 * MyDearPartner — API Types
 *
 * Typed envelopes for the Django REST Framework backend at mydearpartner.in.
 * DRF uses snake_case field names — mapped to camelCase in service layer.
 */

/** Generic API success response wrapper */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/** DRF paginated list response */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Structured API error */
export interface ApiError {
  code?: string;
  status: number;
  message: string;
  detail?: string | Record<string, string[]>;
  isNetworkError?: boolean;
  isAuthError?: boolean;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

/** Django REST Framework JWT token response (djangorestframework-simplejwt) */
export interface TokenResponse {
  access: string;
  refresh: string;
}

/** DRF token refresh response */
export interface TokenRefreshResponse {
  access: string;
}

/** Auth user minimal payload */
export interface AuthUser {
  id: string;
  email: string;
  mobile?: string;
  profile_complete: boolean;
  is_premium?: boolean;
  plan_slug?: string;
}

/** Login response from backend */
export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

/** Registration response */
export interface RegisterResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

// ─── Profile ────────────────────────────────────────────────────────────────

/** Backend profile shape (snake_case as returned by Django) */
export interface BackendProfile {
  id: string;
  user_id: string;
  name: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  city: string;
  work_location?: string;
  current_city?: string;
  state?: string;
  religion: string;
  profession: string;
  occupation?: string;
  company?: string;
  education: string;
  highest_education?: string;
  height: string;
  about: string;
  about_me?: string;
  photo: string;
  photos?: Array<string | { id?: string | number; image_url?: string; url?: string }>;
  photo_id?: string | number;
  primary_photo?: { id?: string | number; image_url?: string; url?: string; is_primary?: boolean } | null;
  hobbies?: string[];
  interests: string[];
  compatibility?: number;
  compatibility_score?: number;
  is_verified: boolean;
  is_online: boolean;
  diet?: string;
  income?: string;
  annual_income?: string;
  mother_tongue?: string;
  horoscope?: string;
  marital_status?: string;
  email?: string;
  mobile_number?: string;
  caste?: string;
  sub_caste?: string;
  gothra?: string;
  star_nakshatra?: string;
  manglik_status?: string;
  blood_group?: string;
  complexion?: string;
  weight?: string;
  father_status?: string;
  mother_status?: string;
  family_type?: string;
  family_status?: string;
  family_location?: string;

  managed_by?: 'Self' | 'Parent' | 'Sibling' | 'Relative';
  verification_badges?: ('id' | 'education' | 'employment')[];
  lifestyle?: { diet?: string; smoking?: string; drinking?: string; living_arrangement?: string };

  // Subscription fields (added based on architecture review)
  is_premium?: boolean;
  current_plan_slug?: string;
  contact_unlocks?: number;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  managed_by?: string;
  age?: number;
  gender?: string;
  current_city?: string;
  work_location?: string;
  city?: string;
  state?: string;
  religion?: string;
  occupation?: string;
  profession?: string;
  company?: string;
  highest_education?: string;
  education?: string;
  height?: string;
  about_me?: string;
  about?: string;
  hobbies?: string[];
  interests?: string[];
  annual_income?: string;
  income?: string;
  mother_tongue?: string;
  marital_status?: string;
  diet?: string;
  horoscope?: string;
  prompts?: { question: string; answer: string }[];
}

// ─── Interests ───────────────────────────────────────────────────────────────

export type InterestStatus = 'pending' | 'accepted' | 'declined';

export interface BackendInterest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: InterestStatus;
  created_at: string;
  from_profile?: BackendProfile;
  to_profile?: BackendProfile;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface BackendMessage {
  id: string;
  chat_id: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id?: string;
  text: string;
  created_at: string;
  is_read?: boolean;
}

export interface BackendChat {
  id: string;
  partner_id: string;
  profile?: BackendProfile;
  lastMessage?: string;
  time?: string;
  unread?: number;
  last_message_sender_id?: string;
  last_sender_id?: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface DeviceTokenPayload {
  token: string;
  platform: 'ios' | 'android';
}

// ─── Search Filters ──────────────────────────────────────────────────────────

export interface SearchFilters {
  gender?: string;
  min_age?: number;
  max_age?: number;
  city?: string;
  religion?: string;
  profession?: string;
  verified_only?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}
