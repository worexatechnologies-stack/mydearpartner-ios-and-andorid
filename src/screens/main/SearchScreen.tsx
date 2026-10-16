import { sameProfileCity } from '../../utils/profileLocation';
import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AuthImage from '../../components/AuthImage';
import LoadingState from '../../components/LoadingState';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useProfileSearch } from '../../hooks/useProfileSearch';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { colors, radii, shadow } from '../../theme/theme';
import { Profile } from '../../types/models';
import { computeCompatibilityScore } from '../../utils/compatibility';
import { triggerHaptic } from '../../utils/haptics';
import { isInterestQuotaError } from '../../utils/interestErrors';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Search'>,
  NativeStackScreenProps<RootStackParamList>
>;

const QUICK_PROMPTS = [
  { id: 'near_me', label: 'Near me', icon: 'location', color: '#6366F1' },
  { id: 'high_match', label: '90%+ match', icon: 'flame', color: '#F59E0B' },
  {
    id: 'same_lang',
    label: 'Same language',
    icon: 'chatbubbles',
    color: '#10B981',
  },
  {
    id: 'working_prof',
    label: 'Working professional',
    icon: 'briefcase',
    color: '#3B82F6',
  },
  {
    id: 'verified',
    label: 'Verified only',
    icon: 'shield-checkmark',
    color: '#14B8A6',
  },
];

const RELIGIONS = [
  'All',
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Jain',
  'Buddhist',
];
const LANGUAGES = [
  'All',
  'Telugu',
  'Hindi',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
];
const CITIES = [
  'All',
  'Bangalore',
  'Mumbai',
  'Hyderabad',
  'Chennai',
  'Delhi NCR',
  'Pune',
  'Kolkata',
];
const MARITAL_STATUSES = ['All', 'Never Married', 'Divorced', 'Widowed'];
const EDUCATIONS = [
  'All',
  'B.Tech / M.Tech',
  'MBA',
  'MS / Overseas',
  'MBBS / Doctor',
  'CA / Finance',
  'Graduate',
];
const PROFESSIONS = [
  'All',
  'Software / IT',
  'Doctor / Healthcare',
  'Business / Entrepreneur',
  'Banking',
  'Civil Services',
];

function ProfileGridCard({
  profile,
  isShortlisted,
  interestStatus,
  interestRelationship,
  onToggleShortlist,
  onToggleInterest,
  onPress,
  cardWidth,
  index,
}: {
  profile: Profile;
  isShortlisted: boolean;
  interestStatus?: string;
  interestRelationship?: any;
  onToggleShortlist: () => void;
  onToggleInterest: () => void;
  onPress: () => void;
  cardWidth: number;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 350,
      delay: Math.min(index * 80, 800), // Stagger delay based on index
      useNativeDriver: true,
    }).start();
  }, [enterAnim, index]);

  const matchScore = computeCompatibilityScore(profile);
  const isSent = interestRelationship
    ? interestRelationship.status === 'sent'
    : Boolean(interestStatus);
  const isReceived = interestRelationship?.status === 'received';
  const isMutual = interestRelationship?.isMutual;

  const pressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();
  const pressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <Animated.View
      style={[
        { width: cardWidth, marginBottom: 14 },
        {
          transform: [{ scale: scaleAnim }, { translateY }],
          opacity: enterAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.97}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.cardOuter}
      >
        <View style={styles.cardPhotoWrap}>
          {/* Main photo */}
          <AuthImage
            source={{ uri: profile.photo }}
            style={styles.cardPhoto}
            resizeMode="cover"
          />

          <LinearGradient
            colors={[
              'rgba(0,0,0,0.4)',
              'transparent',
              'rgba(0,0,0,0.05)',
              'rgba(0,0,0,0.1)',
            ]}
            locations={[0, 0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.cardTopRow}>
            <View style={styles.matchBadge}>
              <Icon name="flame" size={10} color="#FF2D78" />
              <Text style={styles.matchBadgeText}>
                {' '}
                {matchScore === null ? 'View profile' : `${matchScore}%`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.heartBtn, isShortlisted && styles.heartBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={
                isShortlisted ? 'Remove from shortlist' : 'Shortlist profile'
              }
              accessibilityState={{ selected: isShortlisted }}
              onPress={onToggleShortlist}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name={isShortlisted ? 'heart' : 'heart-outline'}
                size={14}
                color={isShortlisted ? colors.action : '#695762'}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardPhotoBottom}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginBottom: 2,
            }}
          >
            <Text style={styles.cardName} numberOfLines={1}>
              {profile.name.split(' ')[0]}, {profile.age}
            </Text>
            {profile.isVerified && (
              <View style={styles.verifiedDot}>
                <Icon name="checkmark" size={8} color="#FFF" />
              </View>
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              marginBottom: 8,
            }}
          >
            <Icon name="location-outline" size={11} color="#8B7380" />
            <Text style={styles.cardCity} numberOfLines={1}>
              {profile.city}
            </Text>
          </View>

          <Text style={styles.cardProfession} numberOfLines={1}>
            {profile.profession ||
              profile.education ||
              profile.motherTongue ||
              'View full profile'}
          </Text>
          <TouchableOpacity
            style={[styles.actionBtnGlass, isSent && styles.actionBtnGlassSent]}
            onPress={onToggleInterest}
            activeOpacity={0.82}
          >
            {!isSent && (
              <LinearGradient
                colors={
                  isMutual
                    ? ['#059669', '#10B981']
                    : isReceived
                    ? ['#10B981', '#059669']
                    : [colors.action, colors.actionDark]
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            )}
            <Icon
              name={
                isMutual
                  ? 'chatbubble-ellipses'
                  : isReceived
                  ? 'checkmark-circle'
                  : isSent
                  ? 'time'
                  : 'heart'
              }
              size={14}
              color={isSent ? '#A53760' : '#FFF'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.actionBtnGlassText,
                isSent && styles.actionBtnGlassTextSent,
              ]}
            >
              {isMutual
                ? 'Connected'
                : isReceived
                ? 'Respond'
                : isSent
                ? 'Pending'
                : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function FilterSection({
  label,
  data,
  value,
  onSelect,
}: {
  label: string;
  data: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {data.map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.fPill, value === item && styles.fPillActive]}
            onPress={() => onSelect(item)}
          >
            <Text
              style={[
                styles.fPillText,
                value === item && styles.fPillTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function SearchScreen({ navigation, route }: Props) {
  const { currentUser } = useAuth();
  const {
    isShortlisted,
    isBlockedByMe,
    toggleShortlist,
    sendInterest,
    cancelInterest,
    interestStatusFor,
    getInterestRelationship,
    respondToInterest,
    getOrCreateChatWith,
  } = useAppData();

  const allowance = usePlanAllowance();
  const { refreshUsage } = allowance;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isVeryNarrow = width < 350;
  const columns = isVeryNarrow ? 1 : width >= 1000 ? 4 : width >= 600 ? 3 : 2;
  // On very narrow screens use single column, otherwise 2-column grid
  const cardWidth = Math.floor((width - 28 - 12 * (columns - 1)) / columns);

  const [searchQuery, setSearchQuery] = useState('');
  const search = useProfileSearch(searchQuery, currentUser?.id ?? '');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.openFilters) {
        setShowFiltersModal(true);
        navigation.setParams({ openFilters: false });
      }
    }, [navigation, route?.params?.openFilters]),
  );
  const [refreshing, setRefreshing] = useState(false);

  const [filterReligion, setFilterReligion] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('All');
  const [filterEducation, setFilterEducation] = useState('All');
  const [filterProfession, setFilterProfession] = useState('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshUsage();
    }, [refreshUsage]),
  );

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filterReligion !== 'All') n++;
    if (filterLanguage !== 'All') n++;
    if (filterCity !== 'All') n++;
    if (filterMaritalStatus !== 'All') n++;
    if (filterEducation !== 'All') n++;
    if (filterProfession !== 'All') n++;
    if (verifiedOnly) n++;
    return n;
  }, [
    filterReligion,
    filterLanguage,
    filterCity,
    filterMaritalStatus,
    filterEducation,
    filterProfession,
    verifiedOnly,
  ]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedPrompt(null);
    setFilterReligion('All');
    setFilterLanguage('All');
    setFilterCity('All');
    setFilterMaritalStatus('All');
    setFilterEducation('All');
    setFilterProfession('All');
    setVerifiedOnly(false);
  };

  const handlePromptPress = (id: string) => {
    triggerHaptic('light');
    if (
      (id === 'near_me' && !currentUser?.profile?.city?.trim()) ||
      (id === 'same_lang' && !currentUser?.profile?.motherTongue?.trim())
    ) {
      Alert.alert(
        'Complete your profile',
        'Add your city and mother tongue to use these filters.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Edit profile',
            onPress: () => navigation.navigate('EditProfile'),
          },
        ],
      );
      return;
    }
    if (selectedPrompt === id) {
      setSelectedPrompt(null);
      return;
    }
    setSelectedPrompt(id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await search.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleInterest = async (profile: Profile) => {
    triggerHaptic('light');
    const rel = getInterestRelationship(profile.id);

    // 1. If already mutually matched, navigate to chat
    if (rel.isMutual) {
      if (!allowance.isPremium) {
        Alert.alert(
          'Premium Required',
          'Chatting is reserved for Premium members. Upgrade to Gold or Elite to start chatting.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View Plans',
              onPress: () => navigation.navigate('Membership'),
            },
          ],
        );
        return;
      }
      try {
        const chat = await getOrCreateChatWith(profile.id);
        navigation.navigate('Chat', {
          chatId: chat.id,
          otherProfileId: profile.id,
        });
      } catch (err: any) {
        if (
          err?.status === 403 ||
          err?.isAuthError ||
          err?.message?.toLowerCase().includes('permission') ||
          err?.message?.toLowerCase().includes('plan') ||
          err?.message?.toLowerCase().includes('upgrade')
        ) {
          Alert.alert(
            'Direct Messaging',
            'Direct messaging requires a mutual connection or an upgraded membership plan. Upgrade your plan to chat directly with verified matches!',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'View Plans',
                onPress: () => navigation.navigate('Membership'),
              },
            ],
          );
        } else {
          Alert.alert('Notice', err?.message ?? 'Could not start conversation.');
        }
      }
      return;
    }

    // 2. If received pending interest, accepting creates a match!
    if (rel.status === 'received' && rel.received) {
      try {
        await respondToInterest(rel.received.id, 'accepted');
        Alert.alert(
          'It’s a Match! 🎉',
          `You and ${profile.name} are now connected.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Message',
              onPress: async () => {
                if (!allowance.isPremium) {
                  Alert.alert(
                    'Premium Required',
                    'Chatting is reserved for Premium members. Upgrade to Gold or Elite to start chatting.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'View Plans',
                        onPress: () => navigation.navigate('Membership'),
                      },
                    ],
                  );
                  return;
                }
                try {
                  const chat = await getOrCreateChatWith(profile.id);
                  navigation.navigate('Chat', {
                    chatId: chat.id,
                    otherProfileId: profile.id,
                  });
                } catch (err: any) {
                  if (
                    err?.status === 403 ||
                    err?.isAuthError ||
                    err?.message?.toLowerCase().includes('permission') ||
                    err?.message?.toLowerCase().includes('plan') ||
                    err?.message?.toLowerCase().includes('upgrade')
                  ) {
                    Alert.alert(
                      'Direct Messaging',
                      'Direct messaging requires a mutual connection or an upgraded membership plan. Upgrade your plan to chat directly!',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'View Plans',
                          onPress: () => navigation.navigate('Membership'),
                        },
                      ],
                    );
                  } else {
                    Alert.alert('Notice', err?.message ?? 'Could not open chat.');
                  }
                }
              },
            },
          ],
        );
      } catch (err: any) {
        Alert.alert('Notice', err?.message ?? 'Could not accept interest.');
      }
      return;
    }

    // 3. If sent pending interest, unsend it
    if (rel.status === 'sent' && rel.sent) {
      try {
        await cancelInterest(rel.sent.id);
        Alert.alert(
          'Interest Unsent',
          `Your interest to ${profile.name} has been withdrawn.`,
        );
      } catch (err: any) {
        Alert.alert('Notice', err?.message ?? 'Could not unsend interest.');
      }
      return;
    }

    // 4. Otherwise, check quota and send
    if (allowance.isInterestsExhausted) {
      Alert.alert(
        'Daily Interest Limit Reached',
        `You have used all ${allowance.interestsLimit} daily interests on your ${allowance.planConfig.name}. Your quota resets at 12:00 AM midnight, or upgrade your plan to send more interests!`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Plan',
            onPress: () => navigation.navigate('Membership'),
          },
        ],
      );
      return;
    }
    try {
      await sendInterest(profile.id, profile.userId);
      try {
        const { showInAppNotification } = require('../../utils/notifications');
        showInAppNotification({
          title: 'Request Sent! ❤️',
          message: `Interest request sent to ${profile.name}`,
          icon: 'heart',
          type: 'interest',
          avatarUrl: profile.photo || profile.photos?.[0],
        });
      } catch {
        // ignore
      }
      Alert.alert(
        'Request Sent! ❤️',
        `Your interest request has been sent to ${profile.name}. We'll notify you as soon as they respond!`,
        [{ text: 'Awesome', style: 'default' }],
      );
    } catch (err: any) {
      const isLimitError = isInterestQuotaError(err);
      if (isLimitError) {
        allowance.markDailyInterestsExhausted(true);
        Alert.alert(
          'Daily Interest Limit Reached',
          err?.message && err.message.toLowerCase().includes('limit')
            ? err.message
            : `You have reached your daily limit of ${allowance.interestsLimit} interests on your ${allowance.planConfig.name}. Upgrade your plan to send more interests!`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade Plan',
              onPress: () => navigation.navigate('Membership'),
            },
          ],
        );
      } else {
        Alert.alert(
          'Could not update interest',
          err?.message ?? 'Please try again.',
        );
      }
    }
  };

  const sourceProfiles = search.profiles.filter(
    p => getInterestRelationship(p.id).status === 'none',
  );

  const filteredProfiles = useMemo(() => {
    const myProfile = currentUser?.profile;
    const myCity = (myProfile?.city ?? '').toLowerCase().trim();
    const myLang = (myProfile?.motherTongue ?? '').toLowerCase().trim();

    const filtered = sourceProfiles
      .filter((p: Profile) => {
        if (isBlockedByMe(p.id) || (p.userId && isBlockedByMe(p.userId)))
          return false;
        // 1. Text Search Input Query
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hits = [
            p.name,
            p.city,
            p.state,
            p.profession,
            p.company,
            p.education,
            p.religion,
            p.motherTongue,
            p.caste,
            p.subCaste,
            p.gothra,
            p.about,
          ]
            .filter(Boolean)
            .some(v => String(v).toLowerCase().includes(q));
          if (!hits) return false;
        }

        // 2. Quick Prompts
        if (selectedPrompt === 'near_me' && myCity) {
          if (!sameProfileCity(myCity, p.city)) return false;
        }
        if (selectedPrompt === 'same_lang' && myLang) {
          const pLang = String(p.motherTongue ?? '').toLowerCase();
          if (!pLang || pLang.trim() !== myLang) return false;
        }
        if (
          selectedPrompt === 'high_match' &&
          (computeCompatibilityScore(p) ?? -1) < 90
        ) {
          return false;
        }
        if (selectedPrompt === 'verified' && !p.isVerified) {
          return false;
        }
        if (
          selectedPrompt === 'working_prof' &&
          !(p.profession && String(p.profession).trim())
        ) {
          return false;
        }

        // 3. Dropdown / Filter Modal Options
        if (
          filterReligion !== 'All' &&
          !String(p.religion ?? '')
            .toLowerCase()
            .includes(filterReligion.toLowerCase())
        ) {
          return false;
        }
        if (
          filterLanguage !== 'All' &&
          !String(p.motherTongue ?? '')
            .toLowerCase()
            .includes(filterLanguage.toLowerCase())
        ) {
          return false;
        }
        if (
          filterCity !== 'All' &&
          !String(p.city ?? '')
            .toLowerCase()
            .includes(filterCity.toLowerCase())
        ) {
          return false;
        }
        if (
          filterMaritalStatus !== 'All' &&
          !String(p.maritalStatus ?? '')
            .toLowerCase()
            .includes(filterMaritalStatus.toLowerCase())
        ) {
          return false;
        }
        if (
          filterProfession !== 'All' &&
          !String(p.profession ?? '')
            .toLowerCase()
            .includes(filterProfession.toLowerCase())
        ) {
          return false;
        }
        if (
          filterEducation !== 'All' &&
          !String(p.education ?? '')
            .toLowerCase()
            .includes(filterEducation.toLowerCase())
        ) {
          return false;
        }
        if (verifiedOnly && !p.isVerified) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          (computeCompatibilityScore(b) ?? -1) -
          (computeCompatibilityScore(a) ?? -1),
      );

    // Ensure uniqueness
    const seen = new Set();
    return filtered.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [
    sourceProfiles,
    searchQuery,
    selectedPrompt,
    filterReligion,
    filterLanguage,
    filterCity,
    filterMaritalStatus,
    filterProfession,
    filterEducation,
    verifiedOnly,
    currentUser?.profile,
    isBlockedByMe,
  ]);

  const ListHeader = (
    <View>
      {/* ── Standard Search Header ─────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.headerEyebrow}>MYDEARPARTNER</Text>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              Find your person
            </Text>
            <Text style={styles.headerDescription}>
              Discover someone who feels like home.
            </Text>
          </View>
          <View style={styles.headerEmblem}>
            <Icon name="heart" size={25} color="#FF2D78" />
          </View>
        </View>

        {/* Simple Search input */}
        <View style={styles.searchBox}>
          <View style={styles.searchRow}>
            <Icon name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, city or community"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              selectionColor={colors.primary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
            <View style={styles.searchDivider} />
            <TouchableOpacity
              style={styles.filterIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open search filters"
              onPress={() => {
                triggerHaptic('light');
                setShowFiltersModal(true);
              }}
            >
              <Icon name="options" size={22} color="#0F172A" />
              {activeFiltersCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {activeFiltersCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Quick chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {QUICK_PROMPTS.map(p => {
            const sel = selectedPrompt === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  sel && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => handlePromptPress(p.id)}
                activeOpacity={0.82}
              >
                <Icon
                  name={p.icon as any}
                  size={13}
                  color={sel ? '#FFF' : p.color}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.chipText, sel && { color: '#FFF' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Removable active filter chips */}
        {activeFiltersCount > 0 && (
          <View style={styles.activeChipsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, alignItems: 'center' }}
            >
              <Text style={styles.activeLabel}>Active:</Text>
              {filterCity !== 'All' && (
                <TouchableOpacity
                  style={styles.removeChip}
                  onPress={() => setFilterCity('All')}
                >
                  <Icon
                    name="location-outline"
                    size={11}
                    color="#475569"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.removeChipText}>{filterCity}</Text>
                  <Icon
                    name="close"
                    size={11}
                    color="#475569"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              )}
              {filterLanguage !== 'All' && (
                <TouchableOpacity
                  style={styles.removeChip}
                  onPress={() => setFilterLanguage('All')}
                >
                  <Icon
                    name="chatbubble-outline"
                    size={11}
                    color="#475569"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.removeChipText}>{filterLanguage}</Text>
                  <Icon
                    name="close"
                    size={11}
                    color="#475569"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              )}
              {filterReligion !== 'All' && (
                <TouchableOpacity
                  style={styles.removeChip}
                  onPress={() => setFilterReligion('All')}
                >
                  <Icon
                    name="book-outline"
                    size={11}
                    color="#475569"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.removeChipText}>{filterReligion}</Text>
                  <Icon
                    name="close"
                    size={11}
                    color="#475569"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              )}
              {verifiedOnly && (
                <TouchableOpacity
                  style={styles.removeChip}
                  onPress={() => setVerifiedOnly(false)}
                >
                  <Icon
                    name="shield-checkmark-outline"
                    size={11}
                    color="#475569"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.removeChipText}>Verified</Text>
                  <Icon
                    name="close"
                    size={11}
                    color="#475569"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={resetAllFilters}>
                <Text style={styles.clearAll}>Clear all</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Daily Plan Allowance Strip */}
        <View style={styles.quotaBar}>
          <View style={styles.quotaPill}>
            <Icon name="heart" size={14} color="#A53760" />
            <Text style={styles.quotaLabel} numberOfLines={1}>
              <Text
                style={[
                  styles.quotaHighlight,
                  allowance.isInterestsExhausted && { color: '#A53760' },
                ]}
              >
                {allowance.isInterestsUnlimited
                  ? 'Unlimited'
                  : `${allowance.interestsRemaining} / ${allowance.interestsLimit}`}
              </Text>
            </Text>
          </View>

          <View style={styles.quotaDivider} />

          <View style={styles.quotaPill}>
            <Icon name="eye" size={14} color="#6366F1" />
            <Text style={styles.quotaLabel} numberOfLines={1}>
              <Text
                style={[
                  styles.quotaHighlight,
                  allowance.isViewsExhausted && { color: '#6366F1' },
                ]}
              >
                {allowance.isViewsUnlimited
                  ? 'Unlimited'
                  : `${allowance.viewsRemaining} / ${allowance.viewsLimit}`}
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.quotaPlanBadge,
              { backgroundColor: allowance.planConfig.accentColor + '18' },
            ]}
            onPress={() => navigation.navigate('Membership')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.quotaPlanBadgeText,
                { color: allowance.planConfig.accentColor },
              ]}
            >
              {allowance.planConfig.badge}
            </Text>
            <Icon
              name="chevron-forward"
              size={11}
              color={allowance.planConfig.accentColor}
            />
          </TouchableOpacity>
        </View>

        {/* Results row */}
        <View style={styles.resultsRow}>
          <View>
            <Text style={styles.resultsCount}>
              {filteredProfiles.length} matches found
            </Text>
            <Text style={styles.resultsSub}>Available match scores first</Text>
          </View>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setShowFiltersModal(true)}
          >
            <Icon name="swap-vertical" size={13} color={colors.primary} />
            <Text style={styles.sortBtnText}> Top Match</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        key={`search-${columns}-col-grid`}
        data={filteredProfiles}
        onEndReached={search.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          search.error ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={search.refresh}
              style={{ padding: 20 }}
            >
              <Text style={{ color: colors.danger }}>
                {search.error} Tap to retry.
              </Text>
            </TouchableOpacity>
          ) : search.loading && filteredProfiles.length > 0 ? (
            <LoadingState label="Loading more profiles…" />
          ) : undefined
        }
        keyExtractor={item => item.id}
        numColumns={columns}
        columnWrapperStyle={isVeryNarrow ? undefined : styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              tabBarHeight +
              Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) +
              24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item, index }) => (
          <ProfileGridCard
            profile={item}
            isShortlisted={isShortlisted(item.id)}
            interestStatus={interestStatusFor(item.id)?.status}
            interestRelationship={getInterestRelationship(item.id)}
            onToggleShortlist={() => {
              triggerHaptic('light');
              toggleShortlist(item.id);
            }}
            onToggleInterest={() => handleToggleInterest(item)}
            onPress={() =>
              navigation.navigate('ProfileDetail', { profileId: item.id })
            }
            cardWidth={cardWidth}
            index={index}
          />
        )}
        ListEmptyComponent={
          search.loading ? (
            <LoadingState label="Finding smart matches for you…" />
          ) : (
            <View style={styles.emptyBox}>
              <LinearGradient
                colors={['#FFF1F2', '#FFE4E6']}
                style={styles.emptyIconCircle}
              >
                <Icon name="search-outline" size={30} color={colors.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptySub}>
                Try broadening your preferences or clearing filters
              </Text>
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={resetAllFilters}
              >
                <Text style={styles.emptyResetText}>Reset All Filters</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Smart Filters bottom sheet */}
      <Modal
        transparent
        visible={showFiltersModal}
        onRequestClose={() => setShowFiltersModal(false)}
        animationType="slide"
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setShowFiltersModal(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.sheet,
                  { paddingBottom: Math.max(insets.bottom, 20) },
                ]}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Smart Filters</Text>
                    <Text style={styles.sheetSub}>
                      {activeFiltersCount} filter
                      {activeFiltersCount !== 1 ? 's' : ''} active
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowFiltersModal(false)}
                    style={styles.sheetClose}
                  >
                    <Icon name="close" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.sheetBody}
                >
                  <FilterSection
                    label="Location"
                    data={CITIES}
                    value={filterCity}
                    onSelect={setFilterCity}
                  />
                  <FilterSection
                    label="Religion"
                    data={RELIGIONS}
                    value={filterReligion}
                    onSelect={setFilterReligion}
                  />
                  <FilterSection
                    label="Mother Tongue"
                    data={LANGUAGES}
                    value={filterLanguage}
                    onSelect={setFilterLanguage}
                  />
                  <FilterSection
                    label="Education"
                    data={EDUCATIONS}
                    value={filterEducation}
                    onSelect={setFilterEducation}
                  />
                  <FilterSection
                    label="Profession"
                    data={PROFESSIONS}
                    value={filterProfession}
                    onSelect={setFilterProfession}
                  />
                  <FilterSection
                    label="Marital Status"
                    data={MARITAL_STATUSES}
                    value={filterMaritalStatus}
                    onSelect={setFilterMaritalStatus}
                  />
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => setVerifiedOnly(v => !v)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>
                        Verified Profiles Only
                      </Text>
                      <Text style={styles.toggleSub}>
                        Only government ID verified members
                      </Text>
                    </View>
                    <View
                      style={[styles.track, verifiedOnly && styles.trackOn]}
                    >
                      <View
                        style={[styles.thumb, verifiedOnly && styles.thumbOn]}
                      />
                    </View>
                  </TouchableOpacity>
                </ScrollView>
                <View style={styles.sheetFooter}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={resetAllFilters}
                  >
                    <Text style={styles.resetBtnText}>Reset All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => {
                      triggerHaptic('success');
                      setShowFiltersModal(false);
                    }}
                  >
                    <LinearGradient
                      colors={['#FF1E66', '#B21547']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.applyBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: 120 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 14 },

  // Header
  header: {
    paddingBottom: 0,
    backgroundColor: colors.background,
  },
  headerTitleRow: {
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleCopy: { flex: 1 },
  headerEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#B05F7D',
    marginBottom: 6,
  },
  headerDescription: { fontSize: 12, color: '#8B7380', marginTop: 5 },
  headerEmblem: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardProfession: { fontSize: 11, color: '#8B7380', marginBottom: 12 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#302330',
    letterSpacing: -0.8,
  },

  // Search box (solid white)
  searchBox: {
    marginHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  searchRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#A53760',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  filterBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  // Body
  body: { paddingHorizontal: 14, paddingTop: 16 },

  // Quick chips
  chipsRow: { gap: 8, paddingBottom: 16, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#334155' },

  // Active removable chips
  activeChipsRow: { marginBottom: 14 },
  activeLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  removeChip: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  removeChipText: { fontSize: 11, color: '#A53760', fontWeight: '700' },
  clearAll: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  // Preference card
  prefCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 0,
    backgroundColor: colors.surface,
    ...shadow.md,
  },
  prefCardInner: { padding: 18 },
  prefCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  prefIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefCardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  editPill: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  editPillText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  prefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  prefGridItem: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0,
    ...shadow.sm,
    marginBottom: 12,
  },
  prefItemLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prefItemVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
    marginTop: 2,
  },
  findBtn: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.button,
  },
  findBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Results row
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  resultsCount: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  resultsSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 0,
    ...shadow.sm,
  },
  sortBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  // Grid card
  cardOuter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  cardPhotoWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#F0E3E8',
    position: 'relative',
  },
  cardPhoto: { width: '100%', height: '100%' },
  cardTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
  },
  matchBadgeText: { color: '#6B344A', fontSize: 11, fontWeight: '800' },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#FFF',
  },
  cardPhotoBottom: {
    padding: 12,
  },
  cardName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#302330',
  },
  verifiedDot: {
    backgroundColor: '#3B82F6',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  cardCity: {
    flexShrink: 1,
    fontSize: 11,
    color: '#8B7380',
    fontWeight: '500',
  },
  actionBtnGlass: {
    minHeight: 48,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.action,
  },
  actionBtnGlassSent: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#FFF',
  },
  actionBtnGlassText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  actionBtnGlassTextSent: { color: colors.primary },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyResetBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyResetText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 5, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A050A',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  sheetSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 4 },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetBody: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },

  // Filter pills
  filterGroup: { marginBottom: 24 },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  fPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  fPillActive: { backgroundColor: 'rgba(255,30,102,0.15)', borderColor: '#FF1E66' },
  fPillText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  fPillTextActive: { color: '#FF1E66', fontWeight: '800' },

  // Verified toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
    marginBottom: 32,
  },
  toggleTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  toggleSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: '#FF1E66' },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  thumbOn: { alignSelf: 'flex-end' },

  // Sheet footer
  sheetFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0A050A',
  },
  resetBtn: {
    paddingHorizontal: 24,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  applyBtn: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  applyBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

  // Daily quota strip
  quotaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...shadow.sm,
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  quotaHighlight: {
    fontWeight: '800',
    color: '#0F172A',
  },
  quotaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 6,
  },
  quotaPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  quotaPlanBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
