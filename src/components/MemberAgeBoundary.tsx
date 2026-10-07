import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { get } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { adultDateOfBirth } from '../utils/ageEligibility';
import { colors, spacing } from '../theme/theme';
import AppButton from './AppButton';
import LoadingState from './LoadingState';

/** GitHub main exposes the recorded member DOB through the authenticated me API. */
export default function MemberAgeBoundary({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const userId = currentUser?.id;
  const [approvedId, setApprovedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setApprovedId(undefined);
    if (!userId) return;
    const check = async () => {
      const request = ++revision;
      setBusy(true);
      setApprovedId(undefined);
      setError('');
      try {
        const profile = await get<any>('/auth/me/');
        const member = profile?.user ?? profile?.member ?? profile;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(member?.date_of_birth ?? '');
        if (!match || !adultDateOfBirth(`${match[3]}/${match[2]}/${match[1]}`)) {
          throw new Error('An adult birth date must be recorded on your account. Please contact support to review it.');
        }
        if (active && request === revision) setApprovedId(userId);
      } catch (failure: any) {
        if (active && request === revision) setError(failure?.message || 'Could not verify your account. Please retry.');
      } finally {
        if (active && request === revision) setBusy(false);
      }
    };
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => { active = false; revision++; subscription.remove(); };
  }, [userId, retry]);
  if (!userId || approvedId === userId) return <>{children}</>;
  return <View style={styles.container}>
    {busy || !error ? <LoadingState label="Checking your account…" /> : <>
      <Text style={styles.message}>{error}</Text>
      <AppButton title="Try again" onPress={() => setRetry(value => value + 1)} />
      <AppButton title="Sign out" variant="text" onPress={() => { logout(); }} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  message: { color: colors.text, textAlign: 'center', fontSize: 16 },
});
