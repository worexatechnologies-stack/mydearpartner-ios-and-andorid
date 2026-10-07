/**
 * MyDearPartner — Authentication Context
 *
 * Connects to the Django REST Framework backend at https://mydearpartner.in/api/v1/
 *
 * What changed from the local-only version:
 *  - login/signup now call the real backend API
 *  - Tokens are stored in iOS Keychain (NOT AsyncStorage)
 *  - Session is restored from Keychain on app launch
 *  - logout clears Keychain and notifies backend
 *  - updateProfile calls the real backend PATCH endpoint
 *  - Registers apiClient unauthenticated handler for global 401 handling
 *
 * What is preserved:
 *  - The AuthContextValue interface shape (no screen changes needed)
 *  - The completeProfile / updateProfile signatures
 *  - The isLoading state (used by SplashScreen)
 */

import React,{
createContext,
useCallback,
useContext,
useEffect,
useMemo,
useRef,
useState,
} from 'react';
import { AppState } from 'react-native';
import { registerUnauthenticatedHandler } from '../api/apiClient';
import * as AuthService from '../api/authService';
import * as ProfileService from '../api/profileService';
import { ProfileUpdatePayload } from '../api/types';
import {
initializeMessagingCrypto,
markMessagingCryptoLoggedOut,
} from '../services/MessagingCryptoLifecycle';
import * as PushNotificationService from '../services/PushNotificationService';
import { Profile,User } from '../types/models';
import { getMemberUserIdFromToken } from '../utils/jwt';
import {
clearTokens,
clearUserIds,
loadTokens,
saveUserIds,
} from '../utils/keychain';

interface AuthContextValue {
  isLoading: boolean;
  sessionError: string | null;
  retrySession: () => Promise<void>;
  currentUser: User | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    extraData?: {
      date_of_birth: string;
      policy_version: string;
      accept_terms?: boolean;
      mobile?: string;
      first_name?: string;
      last_name?: string;
      managed_by?: string;
      mother_tongue?: string;
      city?: string;
      gender?: string;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  completeProfile: (profile: Omit<Profile, 'id'>) => Promise<void>;
  updateProfile: (profile: Partial<Profile>) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Build a User object from an auth response + loaded profile */
function buildUser(
  userId: string,
  email: string,
  profileComplete: boolean,
  profile: Profile,
): User {
  return {
    id: userId,
    email,
    profileComplete,
    profile,
    isPremium: profile.isPremium,
    planSlug: profile.currentPlanSlug,
  };
}

const emptyProfile = (userId: string): Profile => ({
  id: userId,
  name: '',
  age: 0,
  gender: 'other',
  city: '',
  religion: '',
  profession: '',
  education: '',
  height: '',
  about: '',
  photo: '',
  interests: [],
});

export function isProfileComplete(profile: Profile): boolean {
  return Boolean(
    profile.name?.trim() &&
      Number.isInteger(profile.age) && profile.age >= 18 && profile.age <= 90 &&
      profile.city?.trim() &&
      ['male', 'female', 'other'].includes(profile.gender),
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionRevision = useRef(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Keep a ref for the device push token so we can pass it to logout
  const pushTokenRef = useRef<string | null>(null);

  // Register global 401 handler — called by apiClient when token refresh fails
  useEffect(() => {
    return registerUnauthenticatedHandler(() => {
      sessionRevision.current += 1;
      setSessionError(null);
      setIsLoading(false);
      setCurrentUser(null);
      markMessagingCryptoLoggedOut();
      clearUserIds().catch(() => console.warn('[Auth] Could not clear messaging identity'));
    });
  }, []);

  const registerPushNotifications = useCallback(async () => {
    const revision = sessionRevision.current;
    try {
      const token =
        await PushNotificationService.requestPermissionAndGetToken();
      if (revision !== sessionRevision.current) return;
      if (token) {
        pushTokenRef.current = token;
        let registered = false;
        // Device registration can race session restoration on a cold launch.
        // Retry briefly so a valid token is not lost before the API is ready.
        for (let attempt = 0; attempt < 3 && !registered; attempt += 1) {
          if (revision !== sessionRevision.current) return;
          registered = await PushNotificationService.registerWithBackend(token);
          if (!registered && attempt < 2) {
            await new Promise<void>(resolve => setTimeout(resolve, 1500));
          }
        }
        if (!registered) {
          console.warn(
            '[AuthContext] Push token was created but the backend did not register it.',
          );
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Error registering push notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const stopTokenRefresh = PushNotificationService.subscribeToTokenRefresh();
    return () => {
      stopTokenRefresh?.();
    };
  }, [currentUser?.id]);

  // An offline launch is recoverable without forcing the user to log in again.
  const retrySession = useCallback(async () => {
    const revision = ++sessionRevision.current;
    setIsLoading(true);
    setSessionError(null);
    try {
      const stored = await loadTokens();
      if (!stored?.accessToken) return;
      const profile = await ProfileService.getMyProfile();
      if (revision !== sessionRevision.current) return;
      const memberId = getMemberUserIdFromToken(stored.accessToken);
      if (memberId) await saveUserIds(profile.id, memberId);
      if (revision !== sessionRevision.current) return;
      await initializeMessagingCrypto();
      if (revision !== sessionRevision.current) return;
      setCurrentUser(buildUser(profile.userId || profile.id, profile.email ?? '', isProfileComplete(profile), profile));
      registerPushNotifications();
    } catch (error) {
      if (revision !== sessionRevision.current) return;
      const message = error instanceof Error ? error.message : '';
      console.warn('[Auth] Session restoration failed', {
        status: (error as { status?: number })?.status,
        reason: message.includes('Secure session storage') ? 'secure-storage'
          : message.includes('Could not load your profile') ? 'invalid-profile'
          : (error as { isNetworkError?: boolean })?.isNetworkError ? 'network' : 'session-initialization',
      });
      if ((error as { status?: number })?.status === 401) {
        await clearTokens();
      } else {
        setSessionError('We could not restore your session. Check your connection and try again.');
      }
    } finally {
      if (revision === sessionRevision.current) setIsLoading(false);
    }
  }, [registerPushNotifications]);

  useEffect(() => {
    retrySession();
    return () => { sessionRevision.current += 1; };
  }, [retrySession]);

  // ─── Login ───────────────────────────────────────────────────────────────
  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const revision = ++sessionRevision.current;
        const isCurrent = () => revision === sessionRevision.current;
        const response = await AuthService.login({ email, password }, isCurrent);
        if (!isCurrent()) return { ok: false, error: 'Sign-in was cancelled. Please try again.' };
        // Only a missing profile means setup is needed; outages must remain errors.
        const profile = await ProfileService.getMyProfile().catch(err => {
          if (err?.status === 404) return emptyProfile(response.user.id);
          throw err;
        });

        if (!isCurrent()) return { ok: false, error: 'Sign-in was cancelled. Please try again.' };
        const isComplete = isProfileComplete(profile);
        

        const user = buildUser(response.user.id, email, isComplete, profile);
        const stored = await loadTokens();
        const memberId = stored?.accessToken
          ? getMemberUserIdFromToken(stored.accessToken)
          : null;
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };
        if (memberId) await saveUserIds(profile.id, memberId);
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };
        await initializeMessagingCrypto();
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };

        setCurrentUser(user);
        // Register only after secure identity restoration.
        registerPushNotifications();

        return { ok: true };
      } catch (err: any) {
        const message =
          typeof err?.message === 'string'
            ? err.message
            : 'Incorrect email or password. Please try again.';
        return { ok: false, error: message };
      }
    },
    [registerPushNotifications],
  );

  // ─── Signup ──────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (
      email: string,
      password: string,
      extraData?: {
        date_of_birth: string;
        policy_version: string;
      accept_terms?: boolean;
        mobile?: string;
        first_name?: string;
        last_name?: string;
        managed_by?: string;
        mother_tongue?: string;
        city?: string;
        gender?: string;
      },
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!email.trim() || !password) {
        return { ok: false, error: 'Email and password are required.' };
      }
      try {
        const revision = ++sessionRevision.current;
        const isCurrent = () => revision === sessionRevision.current;
        const response = await AuthService.register({ email, password, ...extraData }, isCurrent);
        if (!isCurrent()) return { ok: false, error: 'Sign-up was cancelled. Please try again.' };
        
        // Update profile with remaining fields not handled directly by register if they exist
        if (extraData?.managed_by || extraData?.mother_tongue || extraData?.city || extraData?.gender) {
          try {
            await ProfileService.updateMyProfile({
              managed_by: extraData.managed_by as any,
              mother_tongue: extraData.mother_tongue,
              city: extraData.city,
              current_city: extraData.city,
              work_location: extraData.city,
              gender: extraData.gender ? (extraData.gender.charAt(0).toUpperCase() + extraData.gender.slice(1)) : undefined,
            });
          } catch (e) {
            console.warn('Failed to update extra profile fields during signup:', e);
          }
        }

        const profile = emptyProfile(response.user.id);
        // Pre-fill profile with known data
        if (extraData?.first_name || extraData?.last_name) {
          profile.name = `${extraData.first_name || ''} ${extraData.last_name || ''}`.trim();
        }
        if (extraData?.city) profile.city = extraData.city;
        if (extraData?.gender) profile.gender = extraData.gender as any;
        
        const user = buildUser(response.user.id, email, false, profile);
        const stored = await loadTokens();
        const memberId = stored?.accessToken
          ? getMemberUserIdFromToken(stored.accessToken)
          : null;
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };
        if (memberId) await saveUserIds(profile.id, memberId);
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };
        await initializeMessagingCrypto();
        if (!isCurrent()) return { ok: false, error: 'Authentication was cancelled. Please try again.' };

        setCurrentUser(user);
        // Register only after secure identity restoration.
        registerPushNotifications();

        return { ok: true };
      } catch (err: any) {
        const message =
          typeof err?.message === 'string'
            ? err.message
            : 'Could not create account. Please try again.';
        return { ok: false, error: message };
      }
    },
    [registerPushNotifications],
  );

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    sessionRevision.current += 1;
    setIsLoading(true);
    setSessionError(null);
    setCurrentUser(null);
    markMessagingCryptoLoggedOut();
    try {
      await PushNotificationService.unregisterOnLogout();
    } finally {
      try {
        await clearUserIds();
        pushTokenRef.current = null;
        await AuthService.logout();
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // ─── Complete Profile (first-time setup) ─────────────────────────────────
  const completeProfile = useCallback(
    async (profile: Omit<Profile, 'id'>) => {
      if (!currentUser) return;
      const revision = sessionRevision.current;
      try {
        const capitalizedGender = profile.gender
          ? ((profile.gender.charAt(0).toUpperCase() +
              profile.gender.slice(1)) as any)
          : profile.gender;

        const payload: ProfileUpdatePayload = {
          gender: capitalizedGender,
          age: profile.age,
          state: profile.state,
          religion: profile.religion,
          company: profile.company,
          height: profile.height,
          interests: profile.interests,
          current_city: profile.city,
          work_location: profile.city,
          city: profile.city,
          occupation: profile.profession,
          profession: profile.profession,
          highest_education: profile.education,
          education: profile.education,
          about_me: profile.about,
          about: profile.about,
          annual_income: profile.income,
          mother_tongue: profile.motherTongue,
          marital_status: profile.maritalStatus,
        };
        if (profile.name) {
          const parts = profile.name.trim().split(' ');
          payload.first_name = parts[0];
          payload.last_name = parts.slice(1).join(' ') || undefined;
          payload.name = profile.name.trim();
        }
        const updatedProfile = await ProfileService.updateMyProfile(payload);
        if (revision !== sessionRevision.current) return;
        setCurrentUser(prev =>
          prev && prev.id === currentUser.id
            ? buildUser(prev.id, prev.email, isProfileComplete(updatedProfile), updatedProfile)
            : prev,
        );
      } catch (err) {
        // The setup screen displays the error and lets the user retry.
        throw err;
      }
    },
    [currentUser],
  );

  // ─── Update Profile ──────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (partial: Partial<Profile>) => {
      if (!currentUser) throw new Error('Please sign in to save your profile.');
      const revision = sessionRevision.current;
      try {
        // Map camelCase to snake_case for backend
        const payload: ProfileUpdatePayload = {};
        if (partial.name !== undefined) {
          const parts = partial.name.trim().split(/\s+/);
          payload.first_name = parts[0];
          payload.last_name = parts.slice(1).join(' ');
        }
        // The live profile endpoint rejects age as an unsupported field.
        if (partial.gender !== undefined) payload.gender = partial.gender;
        if (partial.diet !== undefined) {
          throw new Error('Diet cannot currently be changed. Other profile changes have not been saved.');
        }
        if (partial.horoscope !== undefined) payload.horoscope = partial.horoscope;
        if (partial.prompts !== undefined) payload.prompts = partial.prompts;
        if (partial.city !== undefined) {
          payload.work_location = partial.city;
        }
        if (partial.state !== undefined) payload.state = partial.state;
        if (partial.religion !== undefined) payload.religion = partial.religion;
        if (partial.profession !== undefined) {
          payload.occupation = partial.profession;
        }
        if (partial.company !== undefined) payload.company = partial.company;
        if (partial.education !== undefined) {
          payload.highest_education = partial.education;
        }
        if (partial.height !== undefined) payload.height = partial.height;
        if (partial.about !== undefined) {
          payload.about = partial.about;
        }
        if (partial.interests !== undefined)
          payload.hobbies = partial.interests;
        if (partial.income !== undefined) {
          payload.annual_income = partial.income;
        }
        if (partial.motherTongue !== undefined)
          payload.mother_tongue = partial.motherTongue;
        if (partial.maritalStatus !== undefined)
          payload.marital_status = partial.maritalStatus;

        const updated = await ProfileService.updateMyProfile(payload);
        if (revision !== sessionRevision.current) return;
        setCurrentUser(prev =>
          prev?.id === currentUser.id
            ? buildUser(prev.id, prev.email, isProfileComplete(updated), updated)
            : prev,
        );
      } catch (err: any) {
        console.warn('[AuthContext] updateProfile error:', err?.message);
        throw err;
      }
    },
    [currentUser],
  );

  // ─── Refresh Current User ──────────────────────────────────────────────────
  const refreshCurrentUser = useCallback(async () => {
    if (!currentUser) return;
    const revision = sessionRevision.current;
    try {
      const profile = await ProfileService.getMyProfile();
      if (revision !== sessionRevision.current) return;
      setCurrentUser(prev => {
        if (!prev || prev.id !== currentUser.id) return prev;
        return buildUser(prev.id, prev.email, isProfileComplete(profile), profile);
      });
    } catch (err: any) {
      console.warn('[AuthContext] refreshCurrentUser error:', err?.message);
    }
  }, [currentUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshCurrentUser();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshCurrentUser]);

  const value = useMemo(
    () => ({
      isLoading,
      sessionError,
      retrySession,
      currentUser,
      login,
      signup,
      logout,
      completeProfile,
      updateProfile,
      refreshCurrentUser,
    }),
    [
      isLoading,
      sessionError,
      retrySession,
      currentUser,
      login,
      signup,
      logout,
      completeProfile,
      updateProfile,
      refreshCurrentUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
