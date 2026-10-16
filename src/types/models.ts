/**
 * Core domain types for the MyDearPartner matrimony app.
 */

export type Gender = 'male' | 'female' | 'other';

export interface Profile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  state?: string;
  religion: string;
  profession: string;
  company?: string;
  education: string;
  height: string;
  about: string;
  photo: string;
  photos?: string[];
  photoIds?: Record<string, string>;
  interests: string[];
  prompts?: { question: string; answer: string }[];
  compatibilityScore?: number;
  isVerified?: boolean;
  isOnline?: boolean;
  diet?: string;
  income?: string;
  motherTongue?: string;
  horoscope?: string;
  maritalStatus?: string;
  email?: string;
  mobileNumber?: string;
  userId?: string;
  caste?: string;
  subCaste?: string;
  gothra?: string;
  starNakshatra?: string;
  manglikStatus?: string;
  bloodGroup?: string;
  complexion?: string;
  weight?: string;
  fatherStatus?: string;
  motherStatus?: string;
  familyType?: string;
  familyStatus?: string;
  familyLocation?: string;

  // Matrimony Specific
  photoPrivacy?: 'public' | 'accepted_only' | 'blurred';
  managedBy?: 'Self' | 'Parent' | 'Sibling' | 'Relative';
  verificationBadges?: ('id' | 'education' | 'employment')[];
  lifestyle?: {
    diet?: string;
    smoking?: string;
    drinking?: string;
    livingArrangement?: string;
  };

  // Subscription fields
  isPremium?: boolean;
  currentPlanSlug?: string;
  contactUnlocks?: number;
  activeMembership?: {
    id?: string;
    plan_slug?: string;
    plan_name?: string;
    is_active?: boolean;
    limits?: {
      daily_interests_limit?: number;
      daily_profile_views_limit?: number;
      daily_views_limit?: number;
      contact_unlocks?: number;
      [key: string]: any;
    };
    contact_unlocks?: number;
    daily_interests_limit?: number;
    daily_profile_views_limit?: number;
    daily_views_limit?: number;
    [key: string]: any;
  };
}

export interface FilterOptions {
  gender?: Gender | 'all';
  minAge?: number;
  maxAge?: number;
  city?: string;
  religion?: string;
  profession?: string;
  verifiedOnly?: boolean;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  profileComplete: boolean;
  profile: Profile;
  isPremium?: boolean;
  planSlug?: string;
}

export type InterestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'withdrawn';

export interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: InterestStatus;
  createdAt: number;
  senderProfile?: Profile;
  receiverProfile?: Profile;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface Chat {
  connectionClosed?: boolean;
  id: string;
  participantIds: [string, string];
  lastMessage?: string;
  lastMessageAt?: number;
  lastSenderId?: string;
  otherProfile?: Profile;
  unreadCount?: number;
}
