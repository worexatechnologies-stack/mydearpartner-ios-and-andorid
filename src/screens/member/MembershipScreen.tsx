import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Platform,
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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import BufferingIndicator from '../../components/BufferingIndicator';
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
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

const PAYMENT_BASE_URL = 'https://mydearpartner.in/membership/';

// ── Custom Matched SVGs ───────────────────────────────────────────────────────
function CrownSvg({
  size = 26,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="3.5" cy="5" r="1.5" />
      <Circle cx="12" cy="3.5" r="1.5" />
      <Circle cx="20.5" cy="5" r="1.5" />
      <Path d="M4.5 7.5L3 17h18l-1.5-9.5-4.5 4.5-3-7-3 7z" />
      <Rect x="3.5" y="18.5" width="17" height="2" rx="1" />
    </Svg>
  );
}

function DiamondSvg({
  size = 26,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 3h12l4 6-10 12L2 9z" />
      <Path d="M12 21L7 9h10z" />
      <Path d="M2 9h20" />
      <Path d="M6 3l1.5 6" />
      <Path d="M18 3l-1.5 6" />
    </Svg>
  );
}

function FreeTrialUserSvg({
  size = 26,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="10" cy="7" r="3.6" />
      <Path d="M3 19c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5" />
      <Path
        d="M16 13.5l1.2 2.5 2.8-.5-1.5 2.5.5 2.8-2.6-1.3-2.4 1.5.7-2.8-1.8-2.2 2.8.2z"
        fill={color}
        stroke="none"
      />
    </Svg>
  );
}

interface Plan {
  id: string;
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
  description: string;
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
    name: 'Free Trial',
    price: '₹0',
    priceNum: 0,
    duration: '30 Days',
    durationDays: 30,
    contactUnlocks: 3,
    description:
      'Explore MyDearPartner with our 30-day free trial. Create your profile, discover matrimonial matches, and experience our platform to begin your journey toward finding the right life partner.',
    gradientColors: ['#3A475A', '#2E394A'],
    accentColor: '#2E394A',
    icon: 'person',
    features: [
      'Daily Express Interests',
      'Daily Profile Views',
      'Browse Discover Profiles',
      '3 Direct Contact Numbers',
      'Basic Profile Visibility',
    ],
  },
  {
    id: 'gold',
    slug: 'gold',
    name: 'Gold',
    badge: 'MOST POPULAR',
    recommended: true,
    price: '₹99',
    priceNum: 9900,
    originalPrice: '₹179',
    savingsLabel: 'Save 44%',
    duration: '30 Days',
    durationDays: 30,
    contactUnlocks: 999,
    description:
      'Start your partner search with our Gold Plan. Enjoy an affordable way to explore matrimonial profiles, discover potential matches, and take the next step toward finding your ideal life partner.',
    gradientColors: ['#FBBF24', '#D97706'],
    accentColor: '#D97706',
    icon: 'crown',
    features: [
      'Daily Express Interests',
      'Daily Profile Views',
      '999 Direct Contact Numbers',
      'Unlimited Chat & Audio Calls',
      'Top Profile Spotlight',
      'Verified Gold Crown Badge',
      'Full Astrological Match Reports',
    ],
    paymentUrl: 'https://mydearpartner.in/membership/gold/',
  },
  {
    id: 'platinum',
    slug: 'platinum',
    name: 'Elite',
    badge: 'PREMIUM',
    price: '₹1,999',
    priceNum: 199900,
    originalPrice: '₹3,999',
    savingsLabel: 'Save 50%',
    duration: '30 Days',
    durationDays: 30,
    contactUnlocks: 999,
    description:
      'Experience the Elite Plan for a premium matchmaking journey. Discover potential life partners with enhanced visibility and priority access to profiles.',
    gradientColors: ['#1E293B', '#0F172A'],
    accentColor: '#0F172A',
    icon: 'diamond',
    features: [
      'Unlimited Daily Interests',
      'Unlimited Profile Views',
      '999 Direct Contact Numbers',
      'VIP Matchmaking Priority',
      'Highest Placement in Search Results',
      'Full Horoscope & Kundali Matching',
      'Dedicated Relationship Advisor',
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
      toValue: 0.985,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const pressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const isGold = plan.slug === 'gold';

  return (
    <Animated.View
      style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onSelect}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
        ]}
      >
        {/* Floating Badge (Top Right) */}
        {plan.badge && (
          <View
            style={[
              styles.floatingBadge,
              isGold ? styles.goldBadge : styles.eliteBadge,
            ]}
          >
            <View style={{ marginRight: 4 }}>
              <CrownSvg
                size={11}
                color={isGold ? '#FFFFFF' : '#B45309'}
              />
            </View>
            <Text
              style={[
                styles.floatingBadgeText,
                isGold ? styles.goldBadgeText : styles.eliteBadgeText,
              ]}
            >
              {plan.badge}
            </Text>
          </View>
        )}

        {/* Top Row: Icon + Name/Duration + Price/Savings */}
        <View style={styles.cardHeaderRow}>
          {/* Plan Icon Box */}
          <LinearGradient
            colors={plan.gradientColors}
            style={styles.planIconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {plan.slug === 'free' ? (
              <FreeTrialUserSvg size={26} color="#FFFFFF" />
            ) : isGold ? (
              <CrownSvg size={28} color="#FFFFFF" />
            ) : (
              <DiamondSvg size={26} color="#FFFFFF" />
            )}
          </LinearGradient>

          {/* Name & Duration */}
          <View style={styles.planNameWrap}>
            <Text style={styles.planTitle}>{plan.name}</Text>
            <Text style={styles.planDurationText}>{plan.duration}</Text>
          </View>

          {/* Price & Savings Pill */}
          <View style={styles.priceContainer}>
            <Text
              style={[
                styles.planPriceText,
                isGold && styles.goldPriceText,
              ]}
            >
              {plan.price}
            </Text>
            {isGold && plan.savingsLabel && (
              <View style={styles.savingsPill}>
                <Text style={styles.savingsPillText}>{plan.savingsLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Radio + Description Row */}
        <View style={styles.descRow}>
          {/* Custom Radio Button */}
          <View
            style={[
              styles.radioCircle,
              isSelected && styles.radioCircleSelected,
            ]}
          >
            {isSelected && <View style={styles.radioInnerDot} />}
          </View>

          {/* Descriptive text */}
          <Text style={styles.descText}>
            {plan.description}
          </Text>
        </View>

        {isCurrent && (
          <View style={styles.currentPlanTag}>
            <Text style={styles.currentPlanTagText}>CURRENT ACTIVE PLAN</Text>
          </View>
        )}
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
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    activePlanSlug === 'free' ? 'gold' : activePlanSlug || 'gold',
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

        const isFree = (bp.slug || '').toLowerCase().includes('free');
        const isGold = (bp.slug || '').toLowerCase().includes('gold');

        const defaultName = isFree ? 'Free Trial' : isGold ? 'Gold' : 'Elite';
        const defaultBadge = isGold ? 'MOST POPULAR' : isFree ? undefined : 'PREMIUM';
        const defaultIcon = isFree ? 'person' : isGold ? 'trophy' : 'diamond';
        const defaultGrad = isFree
          ? ['#475569', '#334155']
          : isGold
          ? ['#F59E0B', '#D97706']
          : ['#1E293B', '#0F172A'];

        const defaultDesc =
          bp.description ||
          staticPlan?.description ||
          (isFree
            ? 'Explore MyDearPartner with our 30-day free trial. Create your profile, discover matrimonial matches, and experience our platform to begin your journey toward finding the right life partner.'
            : isGold
            ? 'Start your partner search with our Gold Plan. Enjoy an affordable way to explore matrimonial profiles, discover potential matches, and take the next step toward finding your ideal life partner.'
            : 'Experience the Elite Plan for a premium matchmaking journey. Discover potential life partners with enhanced visibility and priority access to profiles.');

        return {
          id: bp.slug || bp.id || `plan_${idx}`,
          membershipPlanId: bp.id,
          slug: bp.slug || `plan_${idx}`,
          name: bp.name || staticPlan?.name || defaultName,
          badge: bp.badge || staticPlan?.badge || defaultBadge,
          recommended: bp.recommended ?? staticPlan?.recommended ?? isGold,
          price: isNaN(rawPrice)
            ? staticPlan?.price || '₹0'
            : '₹' + rawPrice.toLocaleString('en-IN'),
          priceNum: isNaN(rawPrice) ? 0 : Math.round(rawPrice * 100),
          originalPrice: isNaN(rawOriginal)
            ? staticPlan?.originalPrice
            : '₹' + rawOriginal.toLocaleString('en-IN'),
          savingsLabel: staticPlan?.savingsLabel,
          duration:
            bp.duration ||
            (bp.duration_days ? `${bp.duration_days} Days` : '30 Days'),
          durationDays: bp.duration_days ?? staticPlan?.durationDays ?? 30,
          contactUnlocks: limits.contactUnlocks || (isFree ? 3 : 999),
          description: defaultDesc,
          features: Array.isArray(bp.features) && bp.features.length > 0
            ? bp.features
            : staticPlan?.features || [],
          gradientColors: staticPlan?.gradientColors ?? defaultGrad,
          accentColor: staticPlan?.accentColor ?? (isGold ? '#D97706' : '#0F172A'),
          icon: bp.icon || staticPlan?.icon || defaultIcon,
          paymentUrl:
            bp.payment_url ||
            bp.paymentUrl ||
            staticPlan?.paymentUrl ||
            PAYMENT_BASE_URL,
        };
      });
  }, []);

  // Fetch backend plans
  useEffect(() => {
    let isMounted = true;

    getCachedMembershipPlans().then(cached => {
      if (isMounted && cached.length > 0) {
        setPlans(mapBackendPlans(cached));
      }
    });

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

  // Razorpay payment handling
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
        Alert.alert('Free Trial', 'You are on the Free Trial plan.');
        return;
      }
      if (isProcessing) return;

      setIsProcessing(true);

      try {
        if (!plan.membershipPlanId) {
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
          amount: order.amount,
          currency: order.currency,
          name: 'My Dear Partner',
          rotate: true,
          prefill: {
            email: currentUser?.email ?? '',
            contact: currentUser?.profile?.mobileNumber ?? '',
            name: currentUser?.profile?.name ?? '',
          },
          theme: { color: '#D97706' },
        };

        const data = await RazorpayCheckout.open(options);

        // Verification
        try {
          const paymentId = data.razorpay_payment_id;
          await verifyPayment({
            paymentId,
            orderId: data.razorpay_order_id || order.order_id,
            signature: data.razorpay_signature,
            membershipPlanId: plan.membershipPlanId,
            internalOrderId: order.internal_order_id,
          });

          await waitForMembershipActivation(paymentId);
          await refreshCurrentUser();
          markDailyInterestsExhausted(false);
          await refreshUsage();

          Alert.alert(
            'Payment Successful!',
            `Welcome to ${plan.name}! Your membership is now active.`,
            [{ text: 'Start Exploring', onPress: () => navigation.goBack() }],
          );
        } catch (verifyErr) {
          console.warn('[Razorpay] Backend verification failed:', verifyErr);
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

          Alert.alert('Verification Issue', errorMessage);
        }
      } catch (err: any) {
        const code = err?.code;
        if (code === 0 || err?.description === 'cancelled') {
          // Dismissed
        } else {
          Alert.alert(
            'Payment Notice',
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

      {/* Warm champagne luxury background */}
      <LinearGradient
        colors={['#FFFDF8', '#FFF8EE', '#FAF3E8']}
        style={StyleSheet.absoluteFill}
      />

      {/* Intertwining golden matrimony rings in the top-right header */}
      <View
        style={[styles.ringsHeaderContainer, { top: insets.top }]}
        pointerEvents="none"
      >
        <Image
          source={require('../../assets/images/header_wedding_rings.png')}
          style={styles.headerRingsImage}
          resizeMode="contain"
        />
      </View>

      {/* Navigation Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Membership</Text>
          <Text style={styles.headerSubtitle}>
            Choose the right plan for your journey
          </Text>
        </View>

        {/* Balance layout */}
        <View style={{ width: 44 }} />
      </View>

      {/* Plan Cards Scroll View */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingPlans ? (
          <View style={styles.loadingBox}>
            <BufferingIndicator size="large" color="#D97706" />
            <Text style={styles.loadingText}>Loading membership plans…</Text>
          </View>
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              isCurrent={plan.slug === activePlanSlug}
              onSelect={() => setSelectedPlanId(plan.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom + 6, 16) },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.ctaButton,
            isProcessing && { opacity: 0.7 },
          ]}
          onPress={() => handlePayment(selectedPlan)}
          disabled={isProcessing}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={
              isSelectedCurrent
                ? ['#475569', '#334155']
                : ['#B45309', '#D97706', '#92400E']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButtonGradient}
          >
            {isProcessing ? (
              <BufferingIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaButtonText}>
                  {isSelectedCurrent
                    ? `Current Plan: ${selectedPlan.name}`
                    : `Continue with ${selectedPlan.name} · ${selectedPlan.price}`}
                </Text>

                <View style={styles.ctaArrowCircle}>
                  <Icon
                    name="arrow-forward"
                    size={16}
                    color={isSelectedCurrent ? '#334155' : '#B45309'}
                  />
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Security & Guarantee microcopy */}
        <View style={styles.securityRow}>
          <Icon name="shield-checkmark" size={13} color="#94A3B8" />
          <Text style={styles.securityText}>
            Secure payment • Cancel anytime
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  ringsHeaderContainer: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 92,
    height: 70,
    zIndex: 0,
  },
  headerRingsImage: {
    width: '100%',
    height: '100%',
    opacity: 0.88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // ── Plan Card Styles ────────────────────────────────────────────────────────
  cardWrapper: {
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    shadowColor: '#D97706',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },

  // Floating Pill Badges
  floatingBadge: {
    position: 'absolute',
    top: -11,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  goldBadge: {
    backgroundColor: '#D97706',
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 10,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 4,
  },
  goldBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  eliteBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 10,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 4,
  },
  eliteBadgeText: {
    color: '#92400E',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  floatingBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },

  // Card Header
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planNameWrap: {
    flex: 1,
    marginLeft: 14,
  },
  planTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  planDurationText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  planPriceText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  goldPriceText: {
    color: '#B45309',
  },
  savingsPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginTop: 4,
  },
  savingsPillText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },

  // Description Row
  descRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: '#D97706',
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D97706',
  },
  descText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    fontWeight: '400',
  },

  currentPlanTag: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentPlanTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },

  // ── Bottom Bar Styles ───────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  ctaButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    position: 'relative',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ctaArrowCircle: {
    position: 'absolute',
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
