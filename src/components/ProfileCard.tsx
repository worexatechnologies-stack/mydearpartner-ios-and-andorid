import React,{ useRef } from 'react';
import {
Animated,
Platform,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors,fontSizes,radii,spacing } from '../theme/theme';
import { Profile } from '../types/models';
import { computeCompatibilityScore } from '../utils/compatibility';
import AuthImage from './AuthImage';

interface ProfileCardProps {
  profile: Profile;
  onPress: () => void;
  rightAction?: React.ReactNode;
  isShortlisted?: boolean;
  onToggleShortlist?: () => void;
  showShortlist?: boolean;
  index?: number;
}

function ProfileCard({
  profile,
  onPress,
  rightAction,
  isShortlisted = false,
  onToggleShortlist,
  showShortlist = true,
  index = 0,
}: ProfileCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index * 100, 800),
      useNativeDriver: true,
    }).start();
  }, [enterAnim, index]);
  const matchScore = computeCompatibilityScore(profile);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
    }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale: scaleAnim }, { translateY }],
          opacity: enterAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`View ${profile.name}’s profile`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
      >
        {/* Immersive Edge-to-Edge Photo */}
        <View style={styles.photoWrapper}>
          <AuthImage 
            source={{ uri: profile.photo }} 
            style={styles.photo} 
          />

          {/* Gradient Overlay for Text Readability */}
          <LinearGradient
            colors={['transparent', 'rgba(26, 7, 18, 0.2)', 'rgba(26, 7, 18, 0.88)']}
            style={styles.gradientOverlay}
          />

          {/* Top Badges */}
          <View style={styles.topBadgesRow}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}
            >
              {profile.managedBy && profile.managedBy !== 'Self' && (
                <View style={styles.managedBadge}>
                  <Icon name="people" size={11} color="#FFF" />
                  <Text style={styles.managedText}>Managed by {profile.managedBy}</Text>
                </View>
              )}
              {profile.isOnline && (
                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              )}
              <View style={styles.matchBadge}>
                <Icon name="checkmark-circle" size={11} color="#FBBF24" />
                <Text style={styles.matchBadgeText}> {matchScore === null ? 'View profile' : `${matchScore === null ? 'View profile' : `${matchScore}%`} Match`}</Text>
              </View>
            </View>

            {showShortlist && onToggleShortlist ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  isShortlisted ? 'Remove from saved profiles' : 'Save profile'
                }
                accessibilityState={{ selected: isShortlisted }}
                onPress={onToggleShortlist}
                style={styles.heartBtnContainer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View
                  style={[
                    styles.heartBtn,
                    isShortlisted && styles.heartBtnActive,
                  ]}
                >
                  <Icon
                    name={isShortlisted ? 'heart' : 'heart-outline'}
                    size={20}
                    color={colors.white}
                  />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Content Overlay */}
          <View style={styles.contentOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name}, {profile.age}
              </Text>
              
              {/* Verification Badges */}
              <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                {profile.verificationBadges?.includes('id') && (
                  <View style={[styles.verifiedIconContainer, { backgroundColor: '#10B981' }]} accessible accessibilityLabel="ID Verified">
                    <Icon name="shield-checkmark" size={10} color="#FFF" />
                  </View>
                )}
                {profile.verificationBadges?.includes('education') && (
                  <View style={[styles.verifiedIconContainer, { backgroundColor: '#3B82F6' }]} accessible accessibilityLabel="Education Verified">
                    <Icon name="school" size={10} color="#FFF" />
                  </View>
                )}
                {profile.isVerified && !profile.verificationBadges?.length && (
                  <View style={styles.verifiedIconContainer}>
                    <Icon name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.profession} numberOfLines={1}>
              {profile.profession}
            </Text>

            <View style={styles.locationRow}>
              <Icon
                name="location"
                size={14}
                color={colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                {[profile.city, profile.state].filter(Boolean).join(', ') ||
                  profile.city}
              </Text>
            </View>

            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{profile.religion}</Text>
              </View>
              {profile.height ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{profile.height}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
      {rightAction ? (
        <View style={styles.actionFooter}>{rightAction}</View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionFooter: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  cardContainer: {
    width: '100%',
    marginBottom: spacing.lg,
    alignSelf: 'center',
    maxWidth: 600,
    ...Platform.select({
      ios: {
        shadowColor: '#4A122E',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(165, 55, 96, 0.12)',
  },

  // Immersive Photo
  photoWrapper: {
    width: '100%',
    height: 420,
    position: 'relative',
    backgroundColor: '#F9EAF0',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  blurredPhoto: {
    opacity: 0.6,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 10, 29, 0.45)',
  },
  lockText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: 8,
  },
  gradientOverlay: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Badges & Actions (Top)
  topBadgesRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  onlineText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  managedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(165, 55, 96, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 4,
  },
  managedText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(58, 16, 48, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(233, 180, 76, 0.45)',
  },
  matchBadgeText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  heartBtnContainer: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  heartBtn: {
    width: 44, // Slightly larger
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnActive: {
    backgroundColor: colors.primary,
  },

  // Content (Bottom)
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl, // Extra padding at bottom
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  verifiedIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  profession: {
    fontSize: fontSizes.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationText: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill, // Pill shape tags
  },
  tagText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.white,
  },
});

function areEqual(prevProps: ProfileCardProps, nextProps: ProfileCardProps) {
  return (
    prevProps.profile.id === nextProps.profile.id &&
    prevProps.isShortlisted === nextProps.isShortlisted &&
    prevProps.showShortlist === nextProps.showShortlist &&
    prevProps.index === nextProps.index &&
    prevProps.profile.isVerified === nextProps.profile.isVerified &&
    prevProps.profile.photo === nextProps.profile.photo &&
    prevProps.profile.name === nextProps.profile.name &&
    prevProps.rightAction === nextProps.rightAction
  );
}

export default React.memo(ProfileCard, areEqual);
