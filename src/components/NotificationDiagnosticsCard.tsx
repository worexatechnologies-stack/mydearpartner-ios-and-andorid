import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import notifee from '@notifee/react-native';
import { NotificationDiagnostics, notificationNextStep, readNotificationDiagnostics } from '../services/NotificationDiagnostics';
import { CHANNEL_ID_MESSAGES, registerWithBackend, requestPermissionAndGetToken } from '../services/PushNotificationService';
import { colors } from '../theme/theme';
import AppButton from './AppButton';

export default function NotificationDiagnosticsCard() {
  const [result, setResult] = useState<NotificationDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => setResult(await readNotificationDiagnostics()), []);
  useEffect(() => {
    let active = true;
    const read = async () => {
      const value = await readNotificationDiagnostics();
      if (active) setResult(value);
    };
    read();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') read(); });
    return () => { active = false; sub.remove(); };
  }, []);
  const reconnect = async () => {
    setBusy(true); setMessage(null);
    try {
      const token = await requestPermissionAndGetToken();
      if (!token) setMessage('Permission or device registration is unavailable. Check notification settings.');
      else if (!await registerWithBackend(token)) setMessage('Your device could not be registered. Try again later.');
      else setMessage('Device registration confirmed. Actual message delivery still depends on the sender and network.');
      await refresh();
    } catch { setMessage('Could not reconnect notifications. Please try again.'); }
    finally { setBusy(false); }
  };
  const nextStep = result ? notificationNextStep(result) : null;
  const openSettings = (channel?: string) => {
    notifee.openNotificationSettings(channel).catch(() => setMessage('Open this app’s notification settings from your device Settings.'));
  };
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Notification health</Text>
    {nextStep && <View style={styles.summary}>
      <Text accessibilityLiveRegion="polite" style={styles.summaryTitle}>{nextStep.title}</Text>
      <Text style={styles.body}>{nextStep.body}</Text>
      {nextStep.action !== 'none' && <AppButton
        title={nextStep.action === 'messages' ? 'Open chat notification settings' : nextStep.action === 'settings' ? 'Allow notifications' : nextStep.action === 'refresh' ? 'Refresh checks' : 'Reconnect this device'}
        variant="outline" loading={busy} onPress={() => {
          if (nextStep.action === 'messages') openSettings(CHANNEL_ID_MESSAGES);
          else if (nextStep.action === 'settings') openSettings();
          else if (nextStep.action === 'refresh') refresh().catch(() => setMessage('Could not refresh notification settings.'));
          else reconnect();
        }} />}
    </View>}
    <Text style={styles.body}>Permission: {result?.permission || 'Checking…'}</Text>
    <Text style={styles.body}>Messages: {result?.messages === 'system' ? 'Managed in system settings' : result?.messages || 'Checking…'}</Text>
    <Text style={styles.body}>Interests: {result?.interests === 'system' ? 'Managed in system settings' : result?.interests || 'Checking…'}</Text>
    <Text style={styles.body}>Push connection: {result ? result.deviceToken ? 'Available' : 'Not available in this session' : 'Checking…'}</Text>
    <Text style={styles.body}>Device registration: {result?.registration || 'Checking…'}</Text>
    <Text style={styles.note}>These checks show local settings and the last registration attempt. They do not confirm that a background message has arrived.</Text>
    {message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
    {nextStep?.action !== 'reconnect' && <AppButton title="Reconnect notifications" loading={busy} onPress={reconnect} />}
    {nextStep?.action !== 'settings' && <AppButton title="Open notification settings" variant="outline" onPress={() => openSettings()} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 16, borderRadius: 16, backgroundColor: colors.surfaceTint, gap: 10 },
  summary: { gap: 8, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' }, body: { color: colors.textSecondary, fontSize: 13 },
  note: { color: colors.textSecondary, fontSize: 12 },
});
