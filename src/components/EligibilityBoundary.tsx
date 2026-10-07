import React,{ useCallback,useEffect,useRef,useState } from 'react';
import {
AppState,
Pressable,
ScrollView,
StyleSheet,
Text,
View
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { get,post } from '../api/apiClient';
import legal from '../config/legal.json';
import { useAuth } from '../context/AuthContext';
import { spacing } from '../theme/theme';
import { adultDateOfBirth } from '../utils/ageEligibility';
import SafetyCenter,{ SafetyPage } from './SafetyCenter';
// ─── Drum-roll picker constants ────────────────────────────────────────────
const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5; // must be odd
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SIDE_FADE = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
  { val: '01', label: 'Jan' }, { val: '02', label: 'Feb' }, { val: '03', label: 'Mar' },
  { val: '04', label: 'Apr' }, { val: '05', label: 'May' }, { val: '06', label: 'Jun' },
  { val: '07', label: 'Jul' }, { val: '08', label: 'Aug' }, { val: '09', label: 'Sep' },
  { val: '10', label: 'Oct' }, { val: '11', label: 'Nov' }, { val: '12', label: 'Dec' },
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1923 }, (_, i) =>
  String(currentYear - i),
);

// ─── Eligibility types ─────────────────────────────────────────────────────
type Eligibility = {
  eligible: boolean;
  policy_version: string;
  accepted_at?: string;
  date_of_birth?: string | null;
};

// ─── Drum-roll column ───────────────────────────────────────────────────────
interface DrumColumnProps {
  data: string[];
  selectedIndex: number;
  onIndexChange: (i: number) => void;
  label?: string;
  width: number;
}

function DrumColumn({ data, selectedIndex, onIndexChange, label, width }: DrumColumnProps) {
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Pad with empty items so centre aligns
  const padded = ['', '', ...data, '', ''];
  const paddingCount = Math.floor(VISIBLE_ITEMS / 2);

  useEffect(() => {
    listRef.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  const onMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const rawIndex = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(rawIndex, data.length - 1));
      if (clampedIndex !== selectedIndex) onIndexChange(clampedIndex);
    },
    [data.length, selectedIndex, onIndexChange],
  );

  return (
    <View style={[drumStyles.column, { width }]}>
      {label && <Text style={drumStyles.columnLabel}>{label}</Text>}
      <View style={{ height: PICKER_HEIGHT, overflow: 'hidden' }}>
        {/* Selection highlight */}
        <View
          style={[
            drumStyles.selectionHighlight,
            { top: SIDE_FADE, height: ITEM_HEIGHT },
          ]}
          pointerEvents="none"
        />
        {/* Top fade */}
        <LinearGradient
          colors={['rgba(15,8,20,1)', 'rgba(15,8,20,0)']}
          style={[drumStyles.fade, { top: 0, height: SIDE_FADE }]}
          pointerEvents="none"
        />
        {/* Bottom fade */}
        <LinearGradient
          colors={['rgba(15,8,20,0)', 'rgba(15,8,20,1)']}
          style={[drumStyles.fade, { bottom: 0, height: SIDE_FADE }]}
          pointerEvents="none"
        />

        {/* The bounded date options do not need virtualization. Each wheel
            scrolls independently inside the page without nested list windowing. */}
        <ScrollView
          ref={listRef}
          accessibilityLabel={`${label} picker`}
          nestedScrollEnabled
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {padded.map((item, index) => {
            const dataIndex = index - paddingCount;
            const isSelected = dataIndex === selectedIndex;
            return (
              <Pressable
                key={index}
                disabled={!item}
                onPress={() => {
                  if (dataIndex >= 0 && dataIndex < data.length) {
                    onIndexChange(dataIndex);
                    listRef.current?.scrollTo({
                      y: dataIndex * ITEM_HEIGHT,
                      animated: true,
                    });
                  }
                }}
                style={drumStyles.item}
              >
                <Text
                  style={[
                    drumStyles.itemText,
                    isSelected && drumStyles.itemTextSelected,
                    !item && { opacity: 0 },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function EligibilityBoundary({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const userId = currentUser?.id;

  const [approvedUser, setApprovedUser] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<SafetyPage | null>(null);
  const [retry, setRetry] = useState(0);
  const requestRevision = useRef(0);

  // Drum-roll state — default to 25 years ago
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() - 25);
  const [dayIdx, setDayIdx] = useState(defaultDate.getDate() - 1);
  const [monthIdx, setMonthIdx] = useState(defaultDate.getMonth());
  const [yearIdx, setYearIdx] = useState(() => YEARS.indexOf(String(defaultDate.getFullYear())));

  const selectedDay = DAYS[dayIdx];
  const selectedMonth = MONTHS[monthIdx];
  const selectedYear = YEARS[yearIdx];

  // Build the date string DD/MM/YYYY for the validator
  const dateString = `${selectedDay}/${selectedMonth.val}/${selectedYear}`;

  useEffect(() => {
    let active = true;
    setApprovedUser(null);
    setAgreed(false);
    setError('');
    if (!userId) return;
    const check = async () => {
      const revision = ++requestRevision.current;
      setApprovedUser(null);
      setBusy(true);
      try {
        const result = await get<Eligibility>('/safety/eligibility/');
        if (active && revision === requestRevision.current && result.date_of_birth) {
          const parts = result.date_of_birth.split('-');
          const year = YEARS.indexOf(parts[0]);
          const month = Number(parts[1]) - 1;
          const day = Number(parts[2]) - 1;
          if (year >= 0 && month >= 0 && month < 12 && day >= 0 && day < 31) {
            setYearIdx(year);
            setMonthIdx(month);
            setDayIdx(day);
          }
        }
        if (active && revision === requestRevision.current)
          setApprovedUser(
            result.eligible && result.policy_version === legal.version
              ? userId
              : null,
          );
      } catch (err: any) {
        if (active && revision === requestRevision.current) {
          setApprovedUser(null);
          setError(err?.status === 404
            ? 'Account eligibility is not available on the server yet. Please contact support or retry after the service is updated.'
            : 'Unable to check account eligibility. Please retry.');
        }
      } finally {
        if (active && revision === requestRevision.current) setBusy(false);
      }
    };
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      requestRevision.current += 1;
      subscription.remove();
    };
  }, [userId, retry]);

  const submit = async () => {
    if (busy || !agreed || !userId) return;
    const birth = adultDateOfBirth(dateString);
    if (!birth) {
      setError('You must be at least 18 years old to continue.');
      return;
    }
    setBusy(true);
    const revision = ++requestRevision.current;
    setError('');
    try {
      const result = await post<Eligibility>('/safety/eligibility/', {
        date_of_birth: birth,
        policy_version: legal.version,
        accepted: true,
      });
      if (!result.eligible || result.policy_version !== legal.version)
        throw new Error('Eligibility was not confirmed.');
      if (revision === requestRevision.current) setApprovedUser(userId);
    } catch (err: any) {
      if (revision === requestRevision.current) setError(
        err instanceof Error
          ? err.message
          : 'Eligibility could not be confirmed. Please retry.',
      );
    } finally {
      if (revision === requestRevision.current) setBusy(false);
    }
  };

  if (!userId || approvedUser === userId) return <>{children}</>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#0F0814', '#1A0D1A', '#0F0814']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Icon name="heart" size={22} color="#FF1E66" />
          </View>
          <Text style={styles.brandName}>MyDearPartner</Text>
        </View>

        {/* ── Hero text ── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Before you continue</Text>
          <Text style={styles.heroSubtitle}>
            Confirm your date of birth. You must be 18 or older to access
            profiles and messaging.
          </Text>
        </View>

        {/* ── Date Picker Card ── */}
        <View style={styles.pickerCard}>
          <LinearGradient
            colors={['rgba(255,30,102,0.12)', 'rgba(165,55,96,0.05)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pickerCardBorder} />

          <Text style={styles.pickerLabel}>DATE OF BIRTH</Text>

          {/* Displayed selected date */}
          <View style={styles.dateDisplay}>
            <Text style={styles.dateDisplayText}>{dateString}</Text>
            <View style={styles.dateDisplayDot} />
          </View>

          {/* Drum-roll columns */}
          <View style={styles.drumRow}>
            <DrumColumn
              data={DAYS}
              selectedIndex={dayIdx}
              onIndexChange={setDayIdx}
              label="Day"
              width={72}
            />
            <View style={styles.drumDivider} />
            <DrumColumn
              data={MONTHS.map(m => m.label)}
              selectedIndex={monthIdx}
              onIndexChange={setMonthIdx}
              label="Month"
              width={88}
            />
            <View style={styles.drumDivider} />
            <DrumColumn
              data={YEARS}
              selectedIndex={yearIdx}
              onIndexChange={setYearIdx}
              label="Year"
              width={88}
            />
          </View>
        </View>

        {/* ── Policy links ── */}
        <View style={styles.policyCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          {(['terms', 'privacy', 'safety'] as const).map((item, index) => (
            <React.Fragment key={item}>
              <Pressable
                onPress={() => setPage(item)}
                style={({ pressed }) => [
                  styles.policyRow,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={styles.policyLeft}>
                  <Icon
                    name={
                      item === 'terms'
                        ? 'document-text-outline'
                        : item === 'privacy'
                        ? 'shield-outline'
                        : 'people-outline'
                    }
                    size={18}
                    color="rgba(255,30,102,0.8)"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.policyText}>{legal[item].title}</Text>
                </View>
                <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
              </Pressable>
              {index < 2 && <View style={styles.policyDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Agree checkbox ── */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed(!agreed)}
          style={styles.agreeRow}
        >
          <View style={[styles.checkBox, agreed && styles.checkBoxChecked]}>
            {agreed && <Icon name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={styles.agreeText}>
            I accept the Terms and Community & Child Safety Standards and
            acknowledge the Privacy Policy.
          </Text>
        </Pressable>

        {/* ── Error ── */}
        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── CTA ── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm age and continue"
          onPress={submit}
          disabled={busy || !agreed}
          style={({ pressed }) => [
            styles.ctaButton,
            (!agreed || busy) && styles.ctaButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={agreed ? ['#FF1E66', '#A53760'] : ['#3D2035', '#2A1525']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {busy ? (
            <Text style={styles.ctaText}>Verifying…</Text>
          ) : (
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Continue</Text>
              <Icon name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
            </View>
          )}
        </Pressable>

        {/* ── Footer links ── */}
        <View style={styles.footerRow}>
          <Pressable onPress={() => setRetry(v => v + 1)} disabled={busy} style={styles.footerBtn}>
            <Text style={styles.footerLink}>Retry</Text>
          </Pressable>
          <View style={styles.footerDot} />
          <Pressable onPress={() => setPage('delete')} style={styles.footerBtn}>
            <Text style={styles.footerLink}>Delete account</Text>
          </Pressable>
          <View style={styles.footerDot} />
          <Pressable onPress={logout} style={styles.footerBtn}>
            <Text style={styles.footerLink}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={styles.supportText}>
          Need help?{'  '}
          <Text style={{ color: '#FF1E66', fontWeight: '700' }}>
            support@mydearpartner.in
          </Text>
        </Text>
      </ScrollView>

      <SafetyCenter page={page} onClose={() => setPage(null)} />
    </SafeAreaView>
  );
}

// ─── Drum column styles ─────────────────────────────────────────────────────
const drumStyles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.5,
  },
  itemTextSelected: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  selectionHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255,30,102,0.14)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,30,102,0.35)',
    zIndex: 1,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },
});

// ─── Screen styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0814',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 4,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,30,102,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,30,102,0.3)',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Hero
  heroSection: {
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 10,
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    fontWeight: '400',
  },

  // Picker card
  pickerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,30,102,0.2)',
  },
  pickerCardBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: 24,
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,30,102,0.8)',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dateDisplay: {
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dateDisplayText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  dateDisplayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF1E66',
    marginLeft: 8,
  },
  drumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  drumDivider: {
    width: 1,
    height: PICKER_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 6,
    marginTop: 28,
  },

  // Policy card
  policyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  policyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  policyText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  policyDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Agree row
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkBoxChecked: {
    backgroundColor: '#FF1E66',
    borderColor: '#FF1E66',
  },
  agreeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    flex: 1,
    lineHeight: 21,
    fontWeight: '400',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },

  // CTA button
  ctaButton: {
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 4,
  },
  footerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  footerLink: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
  supportText: {
    fontSize: 13,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 20,
  },
});
