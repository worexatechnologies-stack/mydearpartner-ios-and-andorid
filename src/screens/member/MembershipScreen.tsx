import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
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
import analyticsService from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { usePlanAllowance } from '../../utils/planAllowance';
import { colors } from '../../theme/theme';
import { triggerHaptic } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

const PAYMENT_BASE_URL = 'https://mydearpartner.in/membership/';

export interface PlanTier {
  duration: string;
  price: string;
  discount?: string;
}

export interface Plan {
  id: string;
  membershipPlanId?: string;
  slug: string;
  name: string;
  subtitle: string;
  badge?: string;
  price: string;
  priceNum: number;
  originalPrice?: string;
  proratedPrice?: string;
  creditNote?: string;
  duration: string;
  durationDays: number;
  monthlyNote?: string;
  tiers?: PlanTier[];
  contactUnlocks: number;
  description: string;
  paragraphFeature: string;
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
    subtitle: 'Basic search and matching with limitations',
    price: '₹0',
    priceNum: 0,
    duration: '/ 30 Days',
    durationDays: 30,
    monthlyNote: 'Free 30-day experience',
    contactUnlocks: 3,
    description: 'Basic search and matching with limitations',
    paragraphFeature:
      'Explore MyDearPartner with our 30-day free trial. Create your profile, discover matrimonial matches, and experience our platform to begin your journey toward finding the right life partner.',
    features: [
      'Explore MyDearPartner with our 30-day free trial. Create your profile, discover matrimonial matches, and experience our platform to begin your journey toward finding the right life partner.',
    ],
    gradientColors: ['#706574', '#52334F'],
    accentColor: '#706574',
    icon: 'person-outline',
  },
  {
    id: 'gold',
    slug: 'gold',
    name: 'Gold',
    subtitle: 'For active seekers who want priority connections',
    badge: 'MOST POPULAR',
    recommended: true,
    price: '₹99',
    priceNum: 9900,
    duration: '/ 1 Month',
    durationDays: 30,
    monthlyNote: 'About ₹99 / month',
    tiers: [
      { duration: '3 months', price: '₹199', discount: '33% OFF' },
      { duration: '6 months', price: '₹399', discount: '33% OFF' },
      { duration: '12 months', price: '₹999', discount: '16% OFF' },
    ],
    contactUnlocks: 999,
    description: 'For active seekers who want priority connections',
    paragraphFeature:
      'Start your partner search with our Gold Plan. Enjoy an affordable way to explore matrimonial profiles, discover potential matches, and take the next step toward finding your ideal life partner.',
    features: [
      'Start your partner search with our Gold Plan. Enjoy an affordable way to explore matrimonial profiles, discover potential matches, and take the next step toward finding your ideal life partner.',
    ],
    gradientColors: ['#F59E0B', '#D97706'],
    accentColor: colors.action,
    icon: 'heart-outline',
    paymentUrl: 'https://mydearpartner.in/membership/gold/',
  },
  {
    id: 'elite',
    slug: 'elite',
    name: 'Elite',
    subtitle: 'Our most popular plan for faster premium matchmaking',
    badge: '✦ PREMIUM',
    recommended: false,
    price: '₹1,999',
    priceNum: 199900,
    originalPrice: '₹1,999',
    proratedPrice: '₹1,914.24',
    duration: '/ 1 Month',
    durationDays: 30,
    monthlyNote: 'About ₹1,914 / month',
    tiers: [
      { duration: '3 months', price: '₹3,499' },
      { duration: '6 months', price: '₹5,999' },
      { duration: '12 months', price: '₹9,999', discount: '17% OFF' },
    ],
    contactUnlocks: 999,
    description: 'Our most popular plan for faster premium matchmaking',
    paragraphFeature:
      'Experience the Elite Plan for a premium matchmaking journey. Discover potential life partners, explore profiles, and make your search more convenient with an enhanced matrimonial experience designed for your relationship goals.',
    features: [
      'Experience the Elite Plan for a premium matchmaking journey. Discover potential life partners, explore profiles, and make your search more convenient with an enhanced matrimonial experience designed for your relationship goals.',
    ],
    gradientColors: ['#772544', '#302432'],
    accentColor: '#772544',
    icon: 'star-outline',
    paymentUrl: 'https://mydearpartner.in/membership/elite/',
  },
  {
    id: 'platinum',
    slug: 'platinum',
    name: 'Platinum',
    subtitle: 'The ultimate matrimonial package with VIP concierge services',
    badge: undefined,
    recommended: false,
    price: '₹199',
    priceNum: 19900,
    originalPrice: '₹199',
    proratedPrice: '₹114.24',
    duration: '/ 1 Month',
    durationDays: 30,
    monthlyNote: 'About ₹114 / month',
    tiers: [
      { duration: '3 months', price: '₹4,999' },
      { duration: '6 months', price: '₹8,999' },
      { duration: '12 months', price: '₹14,999' },
    ],
    contactUnlocks: 999,
    description: 'The ultimate matrimonial package with VIP concierge services',
    paragraphFeature:
      'Upgrade to our Premium Plan and take your partner search further. Explore matrimonial profiles, connect with potential matches, and enjoy a more rewarding experience as you look for your perfect life partner.',
    features: [
      'Upgrade to our Premium Plan and take your partner search further. Explore matrimonial profiles, connect with potential matches, and enjoy a more rewarding experience as you look for your perfect life partner.',
    ],
    gradientColors: ['#2563EB', '#1E40AF'],
    accentColor: '#2563EB',
    icon: 'shield-checkmark-outline',
    paymentUrl: 'https://mydearpartner.in/membership/platinum/',
  },
];

// ── Plan Card Component ───────────────────────────────────────────────────────
function PlanCard({
  plan,
  isSelected,
  isCurrent,
  daysRemaining,
  hasActiveGold,
  onSelect,
}: {
  plan: Plan;
  isSelected: boolean;
  isCurrent: boolean;
  daysRemaining: number | null;
  hasActiveGold: boolean;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.988,
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
  const isElite = plan.slug === 'elite';
  const isFree = plan.slug === 'free';
  const isPlatinum = plan.slug === 'platinum';

  // Capitalize title cleanly
  const displayName =
    plan.name.toLowerCase() === 'free trial'
      ? 'Free Trial'
      : plan.name.charAt(0).toUpperCase() + plan.name.slice(1);

  // Pro-rata pricing & credit when user has active Gold plan
  const showProrated = !isCurrent && hasActiveGold && !!plan.proratedPrice;
  const displayPrice = showProrated ? plan.proratedPrice : plan.price;
  const originalStrikethrough = showProrated
    ? plan.originalPrice || plan.price
    : null;
  const creditNote = showProrated
    ? plan.creditNote || 'Includes ₹84.76 credit for remaining active days'
    : null;

  return (
    <Animated.View
      style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          triggerHaptic('light');
          onSelect();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
        ]}
      >
        {/* Top Active Bar or Elite Badge */}
        {isCurrent ? (
          <View style={styles.activePlanTopBanner}>
            <Text style={styles.activePlanTopBannerText}>
              {daysRemaining != null
                ? `${daysRemaining} DAYS REMAINING`
                : 'CURRENT ACTIVE PLAN'}
            </Text>
          </View>
        ) : isElite && plan.badge ? (
          <View style={styles.eliteTopBanner}>
            <Text style={styles.eliteTopBannerText}>{plan.badge}</Text>
          </View>
        ) : null}

        <View style={styles.cardInnerPadding}>
          {/* Header Row: Icon + Title & Subtitle */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.planIconCircle}>
              <Icon
                name={
                  isGold
                    ? 'heart-outline'
                    : isElite
                    ? 'star-outline'
                    : isFree
                    ? 'person-outline'
                    : 'shield-checkmark-outline'
                }
                size={22}
                color={
                  isGold
                    ? '#D97706'
                    : isElite
                    ? '#772544'
                    : isFree
                    ? '#6B7280'
                    : isPlatinum
                    ? '#2563EB'
                    : colors.action
                }
              />
            </View>

            <View style={styles.titleInfoWrap}>
              <View style={styles.titleWithRadio}>
                <Text style={styles.planTitleText}>{displayName}</Text>
                {/* Radio selection indicator */}
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected && (
                    <Icon name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </View>
              </View>
              <Text style={styles.planSubtitleText}>{plan.subtitle}</Text>
            </View>
          </View>

          {/* Investment Section */}
          <View style={styles.investmentSection}>
            <Text style={styles.investmentLabel}>INVESTMENT</Text>
            <View style={styles.priceRow}>
              {originalStrikethrough && (
                <Text style={styles.strikethroughPrice}>
                  {originalStrikethrough}
                </Text>
              )}
              <Text
                style={[
                  styles.priceMainText,
                  isSelected && styles.priceMainTextSelected,
                ]}
              >
                {displayPrice}
              </Text>
              <Text style={styles.priceDurationText}> {plan.duration}</Text>
            </View>

            {/* Credit Note (Prorated) */}
            {creditNote && (
              <View style={styles.creditNoteBox}>
                <Text style={styles.creditNoteText}>{creditNote}</Text>
              </View>
            )}

            {/* Monthly note */}
            {plan.monthlyNote ? (
              <Text style={styles.monthlyNoteText}>{plan.monthlyNote}</Text>
            ) : null}
          </View>

          {/* Multi-duration Tiers Table */}
          {plan.tiers && plan.tiers.length > 0 && (
            <View style={styles.tiersContainer}>
              {plan.tiers.map((tier, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tierRow,
                    idx === plan.tiers!.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.tierDurationText}>{tier.duration}</Text>
                  <View style={styles.tierPriceRight}>
                    <Text style={styles.tierPriceText}>{tier.price}</Text>
                    {tier.discount ? (
                      <View style={styles.tierDiscountBadge}>
                        <Text style={styles.tierDiscountBadgeText}>
                          {tier.discount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Description Paragraph with Green Checkmark */}
          <View style={styles.paragraphSection}>
            <View style={styles.greenCheckCircle}>
              <Icon name="checkmark" size={12} color="#059669" />
            </View>
            <Text style={styles.paragraphText}>
              {plan.paragraphFeature || plan.features?.[0] || plan.description}
            </Text>
          </View>

          {/* Card Footer Button / Action */}
          {isCurrent ? (
            <View style={styles.activePlanBtn}>
              <Icon
                name="checkmark"
                size={14}
                color="#059669"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.activePlanBtnText}>✓ Your Active Plan</Text>
            </View>
          ) : (
            <View
              style={[
                styles.selectPlanBtn,
                isSelected && styles.selectPlanBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.selectPlanBtnText,
                  isSelected && styles.selectPlanBtnTextActive,
                ]}
              >
                {isSelected ? '✓ Selected' : `Select ${displayName}`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MembershipScreen({ navigation }: Props) {
  const { currentUser, refreshCurrentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmallDevice = width < 360;
  const allowance = usePlanAllowance();
  const { refreshUsage, markDailyInterestsExhausted } = allowance;
  const activePlanSlug = allowance.planSlug;

  const activeMembership = currentUser?.profile?.activeMembership;
  const daysRemaining =
    activeMembership?.days_remaining ??
    activeMembership?.remaining_days ??
    (activeMembership?.end_date
      ? Math.max(
          0,
          Math.ceil(
            (new Date(activeMembership.end_date).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null);

  const hasActiveGold =
    activePlanSlug === 'gold' && (daysRemaining == null || daysRemaining > 0);

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
        const rawSlug = (bp.slug || '').toLowerCase();
        const isFree = rawSlug.includes('free');
        const isGold = rawSlug.includes('gold');
        const isElite = rawSlug.includes('elite');

        const canonicalSlug = isFree
          ? 'free'
          : isGold
          ? 'gold'
          : isElite
          ? 'elite'
          : 'platinum';

        const staticPlan = DEFAULT_PLANS.find(
          sp => sp.slug === canonicalSlug || sp.id === canonicalSlug,
        );
        const limits = resolvePlanLimits(bp, bp.slug);

        const rawPrice = parseFloat(
          String(bp.price ?? '').replace(/[^0-9.]/g, ''),
        );
        const rawOriginal = parseFloat(
          String(bp.original_price ?? '').replace(/[^0-9.]/g, ''),
        );

        // Name: backend display_name or fallback
        let resolvedName =
          bp.display_name ||
          (bp.name?.toLowerCase() === 'premium' ? 'Platinum' : bp.name) ||
          staticPlan?.name ||
          (isFree
            ? 'Free Trial'
            : isGold
            ? 'Gold'
            : isElite
            ? 'Elite'
            : 'Platinum');
        if (resolvedName.toLowerCase() === 'free trial') resolvedName = 'Free Trial';

        // Subtitle / Description (from backend `description`)
        const subtitle =
          bp.description ||
          staticPlan?.subtitle ||
          (isFree
            ? 'Basic search and matching with limitations'
            : isGold
            ? 'For active seekers who want priority connections'
            : isElite
            ? 'Our most popular plan for faster premium matchmaking'
            : 'The ultimate matrimonial package with VIP concierge services');

        // Badge
        const badge =
          bp.badge && bp.badge.trim()
            ? bp.badge
            : isGold
            ? 'MOST POPULAR'
            : isElite
            ? '✦ PREMIUM'
            : undefined;

        // Pricing Tiers (3m, 6m, 1y)
        const tiers: PlanTier[] = [];
        if (bp.price_3m && parseFloat(bp.price_3m) > 0) {
          tiers.push({
            duration: '3 months',
            price: '₹' + Math.round(parseFloat(bp.price_3m)).toLocaleString('en-IN'),
            discount: bp.discount_3m || undefined,
          });
        }
        if (bp.price_6m && parseFloat(bp.price_6m) > 0) {
          tiers.push({
            duration: '6 months',
            price: '₹' + Math.round(parseFloat(bp.price_6m)).toLocaleString('en-IN'),
            discount: bp.discount_6m || undefined,
          });
        }
        if (bp.price_1y && parseFloat(bp.price_1y) > 0) {
          tiers.push({
            duration: '12 months',
            price: '₹' + Math.round(parseFloat(bp.price_1y)).toLocaleString('en-IN'),
            discount: bp.discount_1y || undefined,
          });
        }

        // Paragraph Feature (from features[0])
        const paragraph =
          (Array.isArray(bp.features) && bp.features[0]) ||
          staticPlan?.paragraphFeature ||
          subtitle;

        // Price display
        const formattedPrice = isNaN(rawPrice)
          ? staticPlan?.price || '₹0'
          : '₹' + Math.round(rawPrice).toLocaleString('en-IN');

        return {
          id: bp.slug || bp.id || `plan_${idx}`,
          membershipPlanId: bp.id,
          slug: canonicalSlug,
          name: resolvedName,
          subtitle,
          badge,
          recommended: bp.recommended ?? staticPlan?.recommended ?? isGold,
          price: formattedPrice,
          priceNum: isNaN(rawPrice) ? 0 : Math.round(rawPrice * 100),
          originalPrice: isNaN(rawOriginal)
            ? staticPlan?.originalPrice
            : '₹' + Math.round(rawOriginal).toLocaleString('en-IN'),
          proratedPrice: staticPlan?.proratedPrice,
          duration: isFree ? '/ 30 Days' : '/ 1 Month',
          durationDays: bp.duration_days ?? staticPlan?.durationDays ?? 30,
          monthlyNote:
            staticPlan?.monthlyNote ||
            (isFree ? 'Free 30-day experience' : `About ${formattedPrice} / month`),
          tiers: tiers.length > 0 ? tiers : staticPlan?.tiers,
          contactUnlocks: limits.contactUnlocks || (isFree ? 3 : 999),
          description: subtitle,
          paragraphFeature: paragraph,
          features: Array.isArray(bp.features) && bp.features.length > 0
            ? bp.features
            : staticPlan?.features || [paragraph],
          gradientColors: staticPlan?.gradientColors ?? ['#772544', '#302432'],
          accentColor: staticPlan?.accentColor ?? '#772544',
          icon: staticPlan?.icon ?? 'sparkles',
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
      triggerHaptic('medium');
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
          theme: { color: colors.primary },
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
          analyticsService
            .trackSubscriptionStateChanged({
              product_id: plan.membershipPlanId || plan.name,
              state: 'active',
              platform: Platform.OS,
            })
            .catch(() => {});

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
              analyticsService
                .trackSubscriptionStateChanged({
                  product_id: plan.membershipPlanId || plan.name,
                  state: 'active',
                  platform: Platform.OS,
                })
                .catch(() => {});
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
          // User dismissed checkout
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
    plans.find(p => p.slug === selectedPlanId || p.id === selectedPlanId) ??
    plans[1] ??
    DEFAULT_PLANS[1];
  const isSelectedCurrent = selectedPlan.slug === activePlanSlug;

  const showProratedForSelected =
    !isSelectedCurrent && hasActiveGold && !!selectedPlan.proratedPrice;
  const bottomDisplayPrice = showProratedForSelected
    ? selectedPlan.proratedPrice
    : selectedPlan.price;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Modern ivory background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FAF8F7' }]} />

      {/* Top Navigation Bar */}
      <View style={[styles.header, isTablet && styles.constrained, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            navigation.goBack();
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={20} color="#1E1622" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isSmallDevice && { fontSize: 18 }]}>Membership Plans</Text>
          <Text style={[styles.headerSubtitle, isSmallDevice && { fontSize: 11 }]}>
            Unlock contacts, unlimited chats & top visibility
          </Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* Plan Cards Scroll View */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.constrained,
          isSmallDevice && styles.scrollContentSmall,
          { paddingBottom: insets.bottom + 170 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingPlans ? (
          <View style={styles.loadingBox}>
            <BufferingIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading membership plans…</Text>
          </View>
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={
                selectedPlanId === plan.slug || selectedPlanId === plan.id
              }
              isCurrent={plan.slug === activePlanSlug}
              daysRemaining={daysRemaining}
              hasActiveGold={hasActiveGold}
              onSelect={() => setSelectedPlanId(plan.slug)}
            />
          ))
        )}

        {/* 100% Secure Checkout Razorpay Trust Card (Website-aligned) */}
        <View style={styles.trustBannerCard}>
          <View style={styles.trustBannerHeader}>
            <Icon
              name="shield-checkmark"
              size={18}
              color="#10B981"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.trustBannerTitle}>
              100% Secure Checkout powered by Razorpay
            </Text>
            <View style={styles.pciBadge}>
              <Text style={styles.pciBadgeText}>PCI-DSS ENCRYPTED</Text>
            </View>
          </View>
          <Text style={styles.trustBannerBody}>
            All transactions are processed in INR (₹) using 256-bit bank-grade
            SSL encryption. Eligible refunds are processed back to your original
            payment method within 5-7 business days per platform terms.
          </Text>
          <View style={styles.trustLinksRow}>
            <Text style={styles.trustLinkText}>Terms</Text>
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustLinkText}>Privacy</Text>
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustLinkText}>Refund Policy</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modern Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom + 8, 18) },
        ]}
      >
        <View style={[styles.bottomBarContent, isTablet && styles.constrained]}>
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
                  : [colors.action, colors.primary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButtonGradient}
            >
              {isProcessing ? (
                <BufferingIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={[styles.ctaButtonText, isSmallDevice && { fontSize: 13.5 }]}>
                    {isSelectedCurrent
                      ? `Current Active Plan (${selectedPlan.name})`
                      : `Continue with ${selectedPlan.name} · ${bottomDisplayPrice}`}
                  </Text>

                  <View style={styles.ctaArrowCircle}>
                    <Icon
                      name="arrow-forward"
                      size={16}
                      color={isSelectedCurrent ? '#475569' : colors.action}
                    />
                  </View>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Security & Guarantee microcopy */}
          <View style={styles.securityRow}>
            <Icon name="lock-closed" size={12} color="#10B981" />
            <Text style={styles.securityText}>
              256-Bit SSL Encrypted  •  Instant Activation  •  Cancel Anytime
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF8F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DFE7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1E1622',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#706574',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 40,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#706574',
    fontWeight: '500',
  },

  // ── Plan Card Styles ────────────────────────────────────────────────────────
  cardWrapper: {
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EFE6EA',
    shadowColor: '#1E1622',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.action,
    borderWidth: 2,
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },

  // Top Card Banners
  activePlanTopBanner: {
    backgroundColor: '#059669',
    paddingVertical: 6.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlanTopBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  eliteTopBanner: {
    backgroundColor: '#772544',
    paddingVertical: 6.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliteTopBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  cardInnerPadding: {
    padding: 16,
  },

  // Card Header Row: Icon + Title & Subtitle
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FAF8F7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleInfoWrap: {
    flex: 1,
  },
  titleWithRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1622',
    letterSpacing: -0.3,
  },
  planSubtitleText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
    fontWeight: '400',
  },

  // Radio Circle
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.action,
    backgroundColor: colors.action,
  },

  // Investment Section
  investmentSection: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  investmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  strikethroughPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  priceMainText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E1622',
    letterSpacing: -0.5,
  },
  priceMainTextSelected: {
    color: colors.action,
  },
  priceDurationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  creditNoteBox: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  creditNoteText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  monthlyNoteText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
  },

  // Multi-duration Tiers Container
  tiersContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tierDurationText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  tierPriceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  tierDiscountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 7,
  },
  tierDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  // Description Paragraph Section
  paragraphSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    backgroundColor: '#FDFBFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F7EDF1',
  },
  greenCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  paragraphText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#4B5563',
    flex: 1,
  },

  // Card Buttons
  activePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.2,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  activePlanBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#059669',
  },
  selectPlanBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  selectPlanBtnActive: {
    backgroundColor: colors.action,
  },
  selectPlanBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  selectPlanBtnTextActive: {
    color: '#FFFFFF',
  },

  // 100% Secure Checkout Razorpay Trust Card
  trustBannerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  trustBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  trustBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  pciBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pciBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CCFBF1',
    letterSpacing: 0.5,
  },
  trustBannerBody: {
    fontSize: 11,
    lineHeight: 16,
    color: '#94A3B8',
    marginBottom: 12,
  },
  trustLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  trustLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  trustDot: {
    fontSize: 11,
    color: '#64748B',
    marginHorizontal: 8,
  },

  // ── Bottom Bar Styles ───────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 248, 250, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F0DFE7',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  ctaButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ctaArrowCircle: {
    position: 'absolute',
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 11.5,
    color: '#706574',
    fontWeight: '600',
  },
  constrained: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContentSmall: {
    paddingHorizontal: 12,
  },
  bottomBarContent: {
    width: '100%',
  },
});
