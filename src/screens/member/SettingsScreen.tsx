import BufferingIndicator from '../../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React,{ useEffect,useMemo,useRef,useState } from 'react';
import {

Alert,
AppState,
DeviceEventEmitter,
ScrollView,
StyleSheet,
Switch,
Text,
TouchableOpacity,
View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { PrivacySettings,UserSettings,privacySettingsService,settingsService } from '../../api/settingsService';
import SafetyCenter,{ SafetyPage } from '../../components/SafetyCenter';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { colors,fontSizes,radii,shadow,spacing } from '../../theme/theme';
import { createPreferenceQueue } from '../../utils/preferenceQueue';
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
const defaults: UserSettings = {
  incognitoMode: false,
  pushNotifications: true,
  emailNotifications: true,
};
const defaultPrivacy: PrivacySettings = {
  contact_visibility: 'matches',
  show_online_status: true,
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </>
  );
}

function ToggleRow({
  icon,
  color,
  title,
  description,
  value,
  onChange,
  last = false,
  disabled = false,
}: {
  icon: string;
  color: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.iconBox, { backgroundColor: color + '16' }]}>
        <Icon name={icon as any} size={19} color={color} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: '#DED7E5', true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function LinkRow({
  icon,
  color,
  title,
  description,
  onPress,
  destructive = false,
  last = false,
}: {
  icon: string;
  color: string;
  title: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, !last && styles.rowBorder]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '16' }]}>
        <Icon name={icon as any} size={19} color={color} />
      </View>
      <View style={styles.rowCopy}>
        <Text
          style={[styles.rowTitle, destructive && { color: colors.danger }]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={styles.rowDescription}>{description}</Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={19} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const [safetyPage, setSafetyPage] = useState<SafetyPage | null>(null);
  const { logout, currentUser } = useAuth();
  const { isIncognitoMode, setIncognitoMode } = useAppData();
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);
  const [privacyReady, setPrivacyReady] = useState(false);
  const privacyRevision = useRef(0);
  const privacyPending = useRef(0);
  const [settingsReady, setSettingsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const serverQueue = useMemo(() => createPreferenceQueue(
    defaults,
    change => settingsService.updateSettings(change),
    value => {
      setSettings(value);
      setIncognitoMode(value.incognitoMode);
    },
  ), [setIncognitoMode]);
  const privacyQueue = useMemo(() => createPreferenceQueue(
    defaultPrivacy,
    change => privacySettingsService.update(change),
    setPrivacy,
  ), []);
  useEffect(() => {
    let active = true;
    setPrivacyReady(false);
    privacyQueue.reset(defaultPrivacy);
    const loadPrivacy = async () => {
      if (privacyPending.current > 0) return;
      const revision = ++privacyRevision.current;
      try {
        const saved = await privacySettingsService.get();
        if (active && revision === privacyRevision.current) {
          privacyQueue.reset(saved);
          setPrivacyReady(true);
        }
      } catch {
        if (active && revision === privacyRevision.current) setPrivacyReady(false);
      }
    };
    loadPrivacy();
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') loadPrivacy();
    });
    const focus = navigation.addListener('focus', loadPrivacy);
    const updates = DeviceEventEmitter.addListener('PRIVACY_SETTINGS_CHANGED', loadPrivacy);
    return () => { active = false; foreground.remove(); updates.remove(); focus(); };
  }, [currentUser?.id, navigation, privacyQueue]);
  useEffect(() => {
    let active = true;
    setSettingsReady(false);
    setLoading(true);
    serverQueue.reset(defaults);
    const load = async () => {
      try {
        const server = await settingsService.getSettings();
        if (!active) return;
        serverQueue.reset(server);
        setSettingsReady(true);
      } catch (error) {
        console.warn('[settings] load failed', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [currentUser?.id, serverQueue]);
  const updateServer = async (key: keyof UserSettings, value: boolean) => {
    if (!settingsReady) return;
    try {
      await serverQueue.update(key, value);
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    }
  };
  const updatePrivacy = async <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) => {
    if (!privacyReady) return;
    privacyRevision.current += 1;
    privacyPending.current += 1;
    try {
      await privacyQueue.update(key, value);
    } catch {
      Alert.alert('Could not save privacy settings', 'Please check your connection and try again.');
    } finally {
      privacyPending.current -= 1;
    }
  };
  const signOut = () =>
    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Keep me signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);


  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={colors.gradientDark} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              <Icon name="person" size={25} color={colors.white} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>ACCOUNT & PREFERENCES</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {currentUser?.profile?.name || 'My Dear Partner'}
              </Text>
              <Text style={styles.heroPlan}>
                {currentUser?.isPremium ? 'Premium member' : 'Free member'} ·
                v0.3.2
              </Text>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Icon name="shield-checkmark" size={15} color="#C4B5FD" />
            <Text style={styles.heroFooterText}>
              Your privacy controls are protected
            </Text>
          </View>
        </LinearGradient>
        {loading ? (
          <BufferingIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <>
            <Section title="Privacy & visibility">
              <ToggleRow
                icon="eye-off-outline"
                color="#7C3AED"
                title="Incognito browsing"
                description={settingsReady ? "Browse without appearing in visitors" : "Settings unavailable"}
                value={isIncognitoMode}
                disabled={!settingsReady}
                onChange={v => updateServer('incognitoMode', v)}
              />
              <ToggleRow
                icon="call-outline"
                color="#0F9F8A"
                title="Protect contact details"
                description={privacyReady ? "Show contact information only after interest" : "Privacy settings unavailable; reconnect to load"}
                value={privacy.contact_visibility !== 'everyone'}
                disabled={!privacyReady}
                onChange={v => updatePrivacy('contact_visibility', v ? 'matches' : 'everyone')}
              />
              <ToggleRow
                icon="images-outline"
                color="#EC4899"
                title="Photo privacy protection"
                description="Blur photos until interest is mutually accepted"
                value={privacy.photo_visibility === 'matches'}
                disabled={!privacyReady}
                onChange={v => updatePrivacy('photo_visibility', v ? 'matches' : 'everyone')}
              />
              <ToggleRow
                icon="radio-outline"
                color="#2563EB"
                title="Show online status"
                description="Let matches know when you are active"
                value={privacy.show_online_status}
                disabled={!privacyReady}
                onChange={v => updatePrivacy('show_online_status', v)}
                last
              />
            </Section>
            <Section title="Notifications">
              <ToggleRow
                icon="notifications-outline"
                color="#F05D7B"
                title="Push notifications"
                description="Messages, interests and account updates"
                value={settings.pushNotifications}
                disabled={!settingsReady}
                onChange={v => updateServer('pushNotifications', v)}
              />
              <ToggleRow
                icon="mail-outline"
                color="#D97706"
                title="Email updates"
                description="Handpicked matches and important notices"
                value={settings.emailNotifications}
                disabled={!settingsReady}
                onChange={v => updateServer('emailNotifications', v)}
                last
              />
            </Section>
            <Section title="Safety & support">
              <LinkRow
                icon="shield-checkmark-outline"
                color="#7C3AED"
                title="Verification centre"
                description="Build trust with a verified profile"
                onPress={() => navigation.navigate('Verification')}
              />
              <LinkRow
                icon="ban-outline"
                color="#EF4444"
                title="Blocked profiles"
                description="Review people you have blocked"
                onPress={() => navigation.navigate('Blocked')}
              />
              <LinkRow
                icon="help-buoy-outline"
                color="#2563EB"
                title="Help & support"
                description="Get help from the My Dear Partner team"
                onPress={() =>
                  Alert.alert(
                    'Support',
                    'Please email support@mydearpartner.in for assistance.',
                  )
                }
                last
              />
            </Section>
            <Section title="Policies">
              {(['privacy', 'terms', 'safety'] as const).map(page => (
                <LinkRow key={page} icon="document-text-outline" color="#7C3AED"
                  title={page === 'privacy' ? 'Privacy Policy' : page === 'terms' ? 'Terms of Service' : 'Community & Child Safety Standards'}
                  onPress={() => setSafetyPage(page)} />
              ))}
            </Section>
            <Section title="Account">
              <LinkRow
                icon="log-out-outline"
                color="#EF4444"
                title="Sign out"
                description="Sign out securely on this device"
                onPress={signOut}
                destructive
              />
              <LinkRow
                icon="pause-circle-outline"
                color="#9F1239"
                title="Delete account and data"
                description="Request deletion of your account and associated data"
                onPress={() => setSafetyPage('delete')}
                destructive
                last
              />
            </Section>
          </>
        )}
        <Text style={styles.version}>MY DEAR PARTNER · VERSION 0.3.2</Text>
      </ScrollView>
      <SafetyCenter page={safetyPage} onClose={() => setSafetyPage(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  hero: {
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroCopy: { flex: 1, marginLeft: spacing.sm },
  heroEyebrow: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroName: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 2,
  },
  heroPlan: { color: '#DDD6FE', fontSize: 12, marginTop: 2 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heroFooterText: { color: '#DDD6FE', fontSize: 12, marginLeft: 6 },
  loader: { marginTop: spacing.xxl },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowCopy: { flex: 1, paddingRight: spacing.sm },
  rowTitle: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.text },
  rowDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  version: {
    color: colors.textTertiary,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
  },
});
