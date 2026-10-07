import BufferingIndicator from '../../components/BufferingIndicator';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React,{ useCallback,useEffect,useRef,useState } from 'react';
import {

Alert,
Animated,
ScrollView,
StatusBar,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
fetchMembershipPlansFromBackend,
getCachedMembershipPlans,
resolvePlanLimits,
} from '../../api/membershipService';
import {
createPaymentOrder,
reconcilePayment,
verifyPayment,
waitForMembershipActivation,
} from '../../api/paymentService';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { colors,shadow } from '../../theme/theme';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

const PAYMENT_BASE_URL = 'https://mydearpartner.in/membership/';

interface Plan {
  id: string;
  /** Database UUID required by the payment API; never replace with slug. */
  membershipPlanId?: string;
  slug: string;
  name: string;
  badge?: string;
  price: string;
  priceNum: number;
  originalPrice?: string;
  savingsLabel?: string;
  duration: string;
  durationDays: number;
  contactUnlocks: number;
  features: string[];
  recommended?: boolean;
  gradientColors: string[];
  accentColor: string;
  icon: string;
  paymentUrl?: string;
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'free',
    slug: 'free',
    name: 'Free Basic',
    price: '₹0',
    priceNum: 0,
    duration: 'Forever',
    durationDays: 0,
    contactUnlocks: 0,
    gradientColors: ['#64748B', '#475569'],
    accentColor: '#64748B',
    icon: 'person-outline',
    features: [
      'Daily Express Interests',
      'Daily Profile Views',
      'Browse Discover Profiles',
      'Receive Messages from Paid Members',
      'Basic Profile Visibility',
    ],
  },
  {
    id: 'gold',
    slug: 'gold',
    name: 'Gold VIP',
    badge: 'MOST POPULAR',
    recommended: true,
    price: '₹4,499',
    priceNum: 449900,
    originalPrice: '₹7,999',
    savingsLabel: 'Save 44%',
    duration: '6 Months',
    durationDays: 180,
    contactUnlocks: 60,
    gradientColors: ['#FBBF24', '#F59E0B'],
    accentColor: '#F59E0B',
    icon: 'medal',
    features: [
      'Daily Express Interests',
      'Daily Profile Views',
      'Direct Contact Unlocks',
      'Unlimited Chat & Audio Calls',
      'Profile Spotlight & Top Placement',
      'Verified Gold Crown Badge',
      'Relationship Manager Support',
      'Full Astrological Match Reports',
    ],
    paymentUrl: 'https://mydearpartner.in/membership/gold/',
  },
  {
    id: 'platinum',
    slug: 'platinum',
    name: 'Platinum Elite',
    badge: 'BEST VALUE',
    price: '₹7,999',
    priceNum: 799900,
    originalPrice: '₹14,999',
    savingsLabel: 'Save 47%',
    duration: '12 Months',
    durationDays: 365,
    contactUnlocks: 150,
    gradientColors: ['#A855F7', '#7C3AED'],
    accentColor: '#8B5CF6',
    icon: 'diamond',
    features: [
      'Unlimited Daily Interests',
      'Unlimited Daily Profile Views',
      'Direct Contact Unlocks',
      'VIP Matchmaking Concierge',
      'Highest Priority in Search Results',
      'Unlimited Photo & Document Access',
      'Dedicated Matchmaker Assistance',
      'All Gold VIP Benefits Included',
    ],
    paymentUrl: 'https://mydearpartner.in/membership/platinum/',
  },
];

// ── Plan Card Component ───────────────────────────────────────────────────────
function PlanCard({
  plan,
  isSelected,
  isCurrent,
  onSelect,
}: {
  plan: Plan;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 50,
    }).start();
  const pressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }], marginBottom: 14 }}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onSelect}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.planCard,
          isSelected && { borderColor: plan.accentColor, borderWidth: 2 },
          plan.recommended && !isSelected && styles.planCardRecommended,
        ]}
      >
        {/* Badge */}
        {plan.badge && (
          <View
            style={[styles.planBadge, { backgroundColor: plan.accentColor }]}
          >
            <Text style={styles.planBadgeText}>{plan.badge}</Text>
          </View>
        )}

        {/* Top row: icon + name + price */}
        <View style={styles.planTopRow}>
          <LinearGradient
            colors={plan.gradientColors}
            style={styles.planIconGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name={plan.icon as any} size={22} color="#FFF" />
          </LinearGradient>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={[
                styles.planName,
                isSelected && { color: plan.accentColor },
              ]}
            >
              {plan.name}
            </Text>
            <Text style={styles.planDuration}>{plan.duration}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            {plan.originalPrice && (
              <Text style={styles.planOriginalPrice}>{plan.originalPrice}</Text>
            )}
            <Text
              style={[
                styles.planPrice,
                isSelected && { color: plan.accentColor },
              ]}
            >
              {plan.price}
            </Text>
            {plan.savingsLabel && (
              <View
                style={[
                  styles.savingsBadge,
                  {
                    backgroundColor: plan.accentColor + '22',
                    borderColor: plan.accentColor + '44',
                  },
                ]}
              >
                <Text style={[styles.savingsText, { color: plan.accentColor }]}>
                  {plan.savingsLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact unlocks banner */}
        {plan.contactUnlocks > 0 && (
          <View
            style={[
              styles.unlockBanner,
              isSelected && {
                backgroundColor: plan.accentColor + '18',
                borderColor: plan.accentColor + '40',
              },
            ]}
          >
            <Icon
              name="call"
              size={13}
              color={isSelected ? plan.accentColor : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.unlockText,
                isSelected && { color: plan.accentColor },
              ]}
            >
              {plan.contactUnlocks} direct contact numbers unlocked
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Features */}
        <View style={styles.featuresList}>
          {plan.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: isSelected
                      ? plan.accentColor + '20'
                      : '#F1F5F9',
                  },
                ]}
              >
                <Icon
                  name="checkmark"
                  size={10}
                  color={isSelected ? plan.accentColor : '#64748B'}
                />
              </View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Selection indicator */}
        <View style={styles.selectionRow}>
          <View
            style={[
              styles.radioOuter,
              isSelected && { borderColor: plan.accentColor },
            ]}
          >
            {isSelected && (
              <View
                style={[
                  styles.radioInner,
                  { backgroundColor: plan.accentColor },
                ]}
              />
            )}
          </View>
          <Text
            style={[
              styles.selectionLabel,
              isSelected && { color: plan.accentColor },
            ]}
          >
            {isCurrent
              ? 'Current Plan'
              : isSelected
              ? 'Selected'
              : 'Tap to select'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MembershipScreen({ navigation }: Props) {
  const { currentUser, refreshCurrentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const allowance = usePlanAllowance();
  const { refreshUsage, markDailyInterestsExhausted } = allowance;
  const activePlanSlug = allowance.planSlug;

  useFocusEffect(
    useCallback(() => {
      refreshUsage();
    }, [refreshUsage]),
  );

  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState(
    activePlanSlug === 'free' ? 'gold' : activePlanSlug,
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mapBackendPlans = useCallback((backendPlans: any[]): Plan[] => {
    return backendPlans
      .filter((bp: any) => {
        const slug = (bp.slug || '').toLowerCase();
        const name = (bp.name || '').toLowerCase();
        return !slug.includes('silver') && !name.includes('silver');
      })
      .map((bp: any, idx: number) => {
        const rawPrice = parseFloat(
          String(bp.price ?? '').replace(/[^0-9.]/g, ''),
        );
        const rawOriginal = parseFloat(
          String(bp.original_price ?? '').replace(/[^0-9.]/g, ''),
        );
        const staticPlan = DEFAULT_PLANS.find(
          sp =>
            (bp.slug && bp.slug.toLowerCase() === sp.slug) ||
            (bp.name && bp.name.toLowerCase().includes(sp.slug)),
        );
        const limits = resolvePlanLimits(bp, bp.slug);

        // Prioritize actual features from the database
        let features: string[] = [];
        if (Array.isArray(bp.features) && bp.features.length > 0) {
          features = bp.features;
        } else {
          features = [
            limits.dailyInterests === Infinity
              ? 'Unlimited Daily Interests'
              : `${limits.dailyInterests} Daily Interests`,
            limits.dailyProfileViews === Infinity
              ? 'Unlimited Daily Profile Views'
              : `${limits.dailyProfileViews} Daily Profile Views`,
            limits.contactUnlocks > 0
              ? `Unlock ${limits.contactUnlocks} Direct Contact Numbers`
              : 'Browse Discover Profiles',
            'Receive Messages from Paid Members',
            'Full Profile Visibility',
          ];
        }

        const isPlatinum = (bp.slug || '').toLowerCase().includes('plat');
        const defaultGrad = isPlatinum
          ? ['#A855F7', '#7C3AED']
          : ['#FBBF24', '#F59E0B'];
        const defaultAccent = isPlatinum ? '#8B5CF6' : '#F59E0B';
        const defaultIcon = isPlatinum ? 'diamond' : 'medal';

        return {
          id: bp.slug || bp.id || `plan_${idx}`,
          membershipPlanId: bp.id,
          slug: bp.slug || `plan_${idx}`,
          name: bp.name || staticPlan?.name || 'Premium Plan',
          badge: bp.badge || staticPlan?.badge,
          recommended: bp.recommended ?? staticPlan?.recommended ?? false,
          price: isNaN(rawPrice)
            ? '₹0'
            : '₹' + rawPrice.toLocaleString('en-IN'),
          priceNum: isNaN(rawPrice) ? 0 : Math.round(rawPrice * 100),
          originalPrice: isNaN(rawOriginal)
            ? undefined
            : '₹' + rawOriginal.toLocaleString('en-IN'),
          savingsLabel: staticPlan?.savingsLabel,
          duration:
            bp.duration ||
            (bp.duration_days ? `${bp.duration_days} Days` : 'N/A'),
          durationDays: bp.duration_days ?? staticPlan?.durationDays ?? 0,
          contactUnlocks: limits.contactUnlocks,
          features,
          gradientColors: staticPlan?.gradientColors ?? defaultGrad,
          accentColor: staticPlan?.accentColor ?? defaultAccent,
          icon: bp.icon || staticPlan?.icon || defaultIcon,
          paymentUrl:
            bp.payment_url ||
            bp.paymentUrl ||
            staticPlan?.paymentUrl ||
            PAYMENT_BASE_URL,
        };
      });
  }, []);

  // Fetch backend plans (dynamic from database)
  useEffect(() => {
    let isMounted = true;

    // 1. Initial cached plans load
    getCachedMembershipPlans().then(cached => {
      if (isMounted && cached.length > 0) {
        setPlans(mapBackendPlans(cached));
      }
    });

    // 2. Fetch fresh backend plans from DB
    setIsLoadingPlans(true);
    fetchMembershipPlansFromBackend()
      .then(fresh => {
        if (isMounted && fresh.length > 0) {
          setPlans(mapBackendPlans(fresh));
        }
      })
      .catch(err => {
        console.warn('[Membership] Could not load plans from backend:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mapBackendPlans]);

  // ── Razorpay Payment ────────────────────────────────────────────────────────
  const handlePayment = useCallback(
    async (plan: Plan) => {
      if (plan.slug === activePlanSlug) {
        Alert.alert(
          'Current Plan',
          `You are already on the ${plan.name} plan.`,
        );
        return;
      }
      if (plan.priceNum === 0) {
        Alert.alert('Free Plan', 'You are on the Free Basic plan.');
        return;
      }
      if (isProcessing) return;

      setIsProcessing(true);

      try {
        // The server is the source of truth for the amount, Razorpay order and
        // activation. Never open Razorpay with a client-created amount/order.
        if (!plan.membershipPlanId) {
          // Cached fallback plans have display data only. Paying against one
          // would omit the database ID the server needs to grant membership.
          throw new Error(
            'Membership plans are still loading. Please try again in a moment.',
          );
        }
        const order = await createPaymentOrder(plan.membershipPlanId);
        const options: any = {
          description: `${plan.name} – ${plan.duration} membership`,
          image: 'https://mydearpartner.in/static/logo.png',
          key: order.key_id,
          order_id: order.order_id,
          amount: order.amount, // Razorpay requires paise; server-derived
          currency: order.currency,
          name: 'My Dear Partner',
          prefill: {
            email: currentUser?.email ?? '',
            contact: currentUser?.profile?.mobileNumber ?? '',
            name: currentUser?.profile?.name ?? '',
          },
          theme: { color: colors.primary },
        };

        const data = await RazorpayCheckout.open(options);

        // Payment successful — verify with backend
        try {
          const paymentId = data.razorpay_payment_id;
          await verifyPayment({
            paymentId,
            orderId: data.razorpay_order_id || order.order_id,
            signature: data.razorpay_signature,
            membershipPlanId: plan.membershipPlanId,
            internalOrderId: order.internal_order_id,
          });
          // A webhook can be concurrent with client verification. Polling the
          // server's status prevents stale UI when either arrives first.
          await waitForMembershipActivation(paymentId);
          await refreshCurrentUser();
          markDailyInterestsExhausted(false);
          await refreshUsage();

          Alert.alert(
            'Payment Successful!',
            `Welcome to ${plan.name}! Your membership is now active.\n\nPayment ID: ${data.razorpay_payment_id}`,
            [{ text: 'Start Exploring', onPress: () => navigation.goBack() }],
          );
        } catch (verifyErr) {
          console.warn('[Razorpay] Backend verification failed:', verifyErr);
          // The server reconciles against Razorpay using its secret key. This
          // remains secure if the app loses connectivity after payment.
          try {
            const reconciled = await reconcilePayment(
              data.razorpay_payment_id,
              plan.membershipPlanId,
            );
            const settled = await waitForMembershipActivation(
              data.razorpay_payment_id,
            );
            await refreshCurrentUser();
            if (reconciled.membership_active || settled?.membership_active) {
              markDailyInterestsExhausted(false);
              await refreshUsage();
              Alert.alert(
                'Payment Successful!',
                `Welcome to ${plan.name}! Your membership is now active.`,
                [
                  {
                    text: 'Start Exploring',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
              return;
            }
          } catch (reconcileErr) {
            console.warn('[Razorpay] Reconciliation failed:', reconcileErr);
          }

          const errorMessage =
            (verifyErr as any)?.message ||
            (verifyErr as any)?.detail ||
            'Verification failed on server.';

          Alert.alert(
            'Verification Failed',
            `Server Error: ${errorMessage}\n\nRazorpay Data:\n${JSON.stringify(
              data,
              null,
              2,
            )}`,
          );
        }
      } catch (err: any) {
        // Razorpay returns error with code/description
        const code = err?.code;
        if (code === 0 || err?.description === 'cancelled') {
          // User dismissed the payment sheet — do nothing
        } else {
          Alert.alert(
            'Payment Failed',
            err?.description ??
              err?.message ??
              'Could not process payment. Please try again.',
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [
      activePlanSlug,
      isProcessing,
      currentUser,
      refreshCurrentUser,
      navigation,
      refreshUsage,
      markDailyInterestsExhausted,
    ],
  );

  const selectedPlan =
    plans.find(p => p.id === selectedPlanId) ?? plans[1] ?? DEFAULT_PLANS[1];
  const isSelectedCurrent = selectedPlan.slug === activePlanSlug;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── Standard Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Plan Cards ────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Plan & Today's Allowance Banner */}
        <View style={styles.allowanceCard}>
          <View style={styles.allowanceHeader}>
            <View>
              <Text style={styles.allowanceSubHeader}>ACTIVE MEMBERSHIP</Text>
              <Text style={styles.allowancePlanTitle}>
                {allowance.planConfig.name}
              </Text>
            </View>
            <View
              style={[
                styles.allowanceBadge,
                { backgroundColor: allowance.planConfig.accentColor + '20' },
              ]}
            >
              <Text
                style={[
                  styles.allowanceBadgeText,
                  { color: allowance.planConfig.accentColor },
                ]}
              >
                {allowance.planConfig.badge}
              </Text>
            </View>
          </View>

          <View style={styles.allowanceDivider} />

          <View style={styles.allowanceStatsRow}>
            {/* Daily Interests */}
            <View style={styles.allowanceStatItem}>
              <View style={styles.allowanceStatTop}>
                <Icon name="heart" size={14} color="#A53760" />
                <Text style={styles.allowanceStatLabel}>Daily Interests</Text>
              </View>
              <Text style={styles.allowanceStatValue}>
                {allowance.isInterestsUnlimited
                  ? 'Unlimited'
                  : `${allowance.interestsRemaining} of ${allowance.interestsLimit} left`}
              </Text>
              <Text style={styles.allowanceStatSub}>
                {allowance.isInterestsUnlimited
                  ? 'Full access'
                  : `${allowance.interestsUsed} of ${allowance.interestsLimit} sent today`}
              </Text>
            </View>

            {/* Profile Views */}
            <View style={styles.allowanceStatItem}>
              <View style={styles.allowanceStatTop}>
                <Icon name="eye" size={14} color="#6366F1" />
                <Text style={styles.allowanceStatLabel}>Profile Views</Text>
              </View>
              <Text style={styles.allowanceStatValue}>
                {allowance.isViewsUnlimited
                  ? 'Unlimited'
                  : `${allowance.viewsRemaining} of ${allowance.viewsLimit} left`}
              </Text>
              <Text style={styles.allowanceStatSub}>
                {allowance.isViewsUnlimited
                  ? 'Full access'
                  : `${allowance.viewsUsed} of ${allowance.viewsLimit} viewed today`}
              </Text>
            </View>
          </View>

          <View style={styles.allowanceFooterRow}>
            <Icon name="time-outline" size={13} color="#64748B" />
            <Text style={styles.allowanceFooterText}>
              Daily allowances reset at 12:00 AM midnight
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose your plan</Text>

        {isLoadingPlans ? (
          <View style={styles.loadingBox}>
            <BufferingIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              isCurrent={plan.id === activePlanSlug}
              onSelect={() => setSelectedPlanId(plan.id)}
            />
          ))
        )}

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              isSelectedCurrent && styles.ctaBtnCurrent,
              isProcessing && { opacity: 0.7 },
            ]}
            onPress={() => handlePayment(selectedPlan)}
            disabled={isProcessing}
            activeOpacity={0.88}
          >
            {isProcessing ? (
              <BufferingIndicator size="small" color="#FFF" />
            ) : (
              <>
                {!isSelectedCurrent && (
                  <LinearGradient
                    colors={
                      selectedPlan.gradientColors.length >= 2
                        ? selectedPlan.gradientColors
                        : colors.gradientPrimary
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
                <Icon
                  name={isSelectedCurrent ? 'checkmark-circle' : 'lock-open'}
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ctaBtnText}>
                    {isSelectedCurrent
                      ? `Current Plan (${selectedPlan.name})`
                      : `Continue with ${selectedPlan.name}`}
                  </Text>
                  {!isSelectedCurrent && (
                    <Text style={styles.ctaBtnSub}>
                      {selectedPlan.price} · {selectedPlan.duration}
                    </Text>
                  )}
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Secure row */}
          <View style={styles.secureRow}>
            <Icon
              name="shield-checkmark"
              size={14}
              color="#10B981"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.secureText}>
              256-bit Secure · Powered by Razorpay · Instant Activation
            </Text>
          </View>

          {/* Razorpay logo area */}
          <View style={styles.payLogosRow}>
            {['Visa', 'MC', 'UPI', 'NB', 'EMI'].map(m => (
              <View key={m} style={styles.payMethodChip}>
                <Text style={styles.payMethodText}>{m}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footerNote}>
            All plans auto-renew unless cancelled. Cancel anytime from account
            settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  // List
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 50 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  // Plan card
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 32, // Equivalent to radii.xxl
    padding: 20,
    borderWidth: 0,
    position: 'relative',
    ...shadow.card,
  },
  planCardRecommended: { borderColor: '#F59E0B' },

  planBadge: {
    position: 'absolute',
    top: -11,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  planBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  planTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  planIconGrad: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  planDuration: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  planOriginalPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  planPrice: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  savingsBadge: {
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  savingsText: { fontSize: 10, fontWeight: '800' },

  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unlockText: { fontSize: 12, fontWeight: '700', color: '#64748B', flex: 1 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 },

  featuresList: { gap: 9, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  featureText: { fontSize: 13, color: '#374151', fontWeight: '600', flex: 1 },

  selectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  selectionLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },

  // CTA
  ctaWrap: { marginTop: 8 },
  ctaBtn: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.button,
  },
  ctaBtnCurrent: { backgroundColor: '#64748B' },
  ctaBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  ctaBtnSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  secureText: { fontSize: 11, color: '#10B981', fontWeight: '700' },

  payLogosRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  payMethodChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  payMethodText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Allowance Card
  allowanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.sm,
  },
  allowanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  allowanceSubHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  allowancePlanTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  allowanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  allowanceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  allowanceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  allowanceStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  allowanceStatItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  allowanceStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  allowanceStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  allowanceStatValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  allowanceStatSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  allowanceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  allowanceFooterText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
