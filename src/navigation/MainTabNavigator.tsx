import { colors } from '../theme/theme';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ChatsListScreen from '../screens/main/ChatsListScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import InterestsScreen from '../screens/main/InterestsScreen';
import MyProfileScreen from '../screens/main/MyProfileScreen';
import SearchScreen from '../screens/main/SearchScreen';
import { useAppStats } from '../hooks/useAppStats';
import { motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_BOTTOM } from './tabBarLayout';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabConfig: Record<
  keyof MainTabParamList,
  { icon: string; iconOutline: string; label: string }
> = {
  Discover: { icon: 'heart', iconOutline: 'heart-outline', label: 'Matches' },
  Search: { icon: 'search', iconOutline: 'search-outline', label: 'Search' },
  Interests: { icon: 'flash', iconOutline: 'flash-outline', label: 'Activity' },
  Chats: {
    icon: 'chatbubble',
    iconOutline: 'chatbubble-outline',
    label: 'Chats',
  },
  MyProfile: {
    icon: 'person',
    iconOutline: 'person-outline',
    label: 'Profile',
  },
};

function TabIcon({
  routeName,
  focused,
  color,
  unreadCount,
  pendingInterestsCount,
  isSmallScreen,
  hasProfileAlert,
}: {
  routeName: keyof MainTabParamList;
  focused: boolean;
  color: string;
  unreadCount: number;
  pendingInterestsCount: number;
  isSmallScreen: boolean;
  hasProfileAlert?: boolean;
}) {
  const config = tabConfig[routeName];
  const reducedMotion = useReducedMotion();
  const showBadge = routeName === 'Chats' && unreadCount > 0;
  const badgeText = unreadCount > 10 ? '10+' : String(unreadCount);
  const showInterestBadge =
    routeName === 'Interests' && pendingInterestsCount > 0;
  const interestBadgeText =
    pendingInterestsCount > 9 ? '9+' : String(pendingInterestsCount);
  const iconSize = isSmallScreen ? 22 : 24;

  const scaleAnim = useRef(
    new Animated.Value(focused ? motion.scale.activeTab : 1.0)
  ).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const badgeScale = useRef(
    new Animated.Value(showBadge || showInterestBadge ? 1 : 0)
  ).current;

  useEffect(() => {
    if (reducedMotion) {
      scaleAnim.setValue(focused ? motion.scale.activeTab : 1.0);
      bgOpacity.setValue(focused ? 1 : 0);
      return;
    }
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? motion.scale.activeTab : 1.0,
        damping: motion.spring.interactive.damping,
        stiffness: motion.spring.interactive.stiffness,
        mass: motion.spring.interactive.mass,
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: focused ? 1 : 0,
        duration: motion.duration.micro,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, reducedMotion, scaleAnim, bgOpacity]);

  useEffect(() => {
    const hasBadge = showBadge || showInterestBadge;
    if (reducedMotion) {
      badgeScale.setValue(hasBadge ? 1 : 0);
      return;
    }
    if (hasBadge) {
      badgeScale.setValue(0.5);
      Animated.spring(badgeScale, {
        toValue: 1,
        damping: motion.spring.bouncy.damping,
        stiffness: motion.spring.bouncy.stiffness,
        mass: motion.spring.bouncy.mass,
        useNativeDriver: true,
      }).start();
    } else {
      badgeScale.setValue(0);
    }
  }, [
    showBadge,
    showInterestBadge,
    badgeScale,
    reducedMotion,
    unreadCount,
    pendingInterestsCount,
  ]);

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={[styles.iconActiveBg, { opacity: bgOpacity }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon
          name={focused ? config.icon : config.iconOutline}
          size={iconSize}
          color={color}
        />
      </Animated.View>
      {showBadge && (
        <Animated.View
          style={[styles.badgeContainer, { transform: [{ scale: badgeScale }] }]}
        >
          <Text style={styles.badgeText}>{badgeText}</Text>
        </Animated.View>
      )}
      {showInterestBadge && (
        <Animated.View
          style={[
            styles.badgeContainer,
            styles.interestBadge,
            { transform: [{ scale: badgeScale }] },
          ]}
        >
          <Text style={styles.badgeText}>{interestBadgeText}</Text>
        </Animated.View>
      )}
      {routeName === 'MyProfile' && hasProfileAlert && (
        <View style={styles.profileAlertDot} />
      )}
    </View>
  );
}

export default function MainTabNavigator() {
  const stats = useAppStats();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = width < 360;
  const isTablet = width >= 600;
  const availableWidth = width - insets.left - insets.right;
  const horizontalMargin = isSmallScreen ? 20 : 32;
  const barWidth = isTablet ? 560 : Math.min(560, Math.max(0, availableWidth - horizontalMargin));
  const barLeft = insets.left + (availableWidth - barWidth) / 2;
  const tabBarHeight = 72 + Math.max(0, fontScale - 1) * 14;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.action,
          tabBarInactiveTintColor: '#7D6978',
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: isSmallScreen ? 10 : 11,
            fontWeight: '700',
            letterSpacing: 0.2,
            marginBottom: 10,
          },
          tabBarHideOnKeyboard: true,
          tabBarAccessibilityLabel: tabConfig[route.name].label,
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabBarHeight,
              bottom: Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM),
              left: barLeft,
              right: barLeft,
              start: barLeft,
              end: barLeft,
              width: barWidth,
              paddingHorizontal: isSmallScreen ? 2 : 4,
              paddingBottom: 0,
            },
          ],
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            paddingTop: 8,
            height: tabBarHeight,
          },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              routeName={route.name as keyof MainTabParamList}
              focused={focused}
              color={color}
              unreadCount={stats.unreadChats}
              pendingInterestsCount={stats.pendingInterests}
              isSmallScreen={isSmallScreen}
              hasProfileAlert={stats.nearingInterestLimit || stats.newMatchesCount > 0}
            />
          ),
        })}
      >
        <Tab.Screen
          name="Discover"
          component={DiscoverScreen}
          options={{ tabBarLabel: tabConfig.Discover.label }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{ tabBarLabel: tabConfig.Search.label }}
        />
        <Tab.Screen
          name="Interests"
          component={InterestsScreen}
          options={{ tabBarLabel: tabConfig.Interests.label }}
        />
        <Tab.Screen
          name="Chats"
          component={ChatsListScreen}
          options={{ tabBarLabel: tabConfig.Chats.label }}
        />
        <Tab.Screen
          name="MyProfile"
          component={MyProfileScreen}
          options={{ tabBarLabel: tabConfig.MyProfile.label }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(165, 55, 96, 0.14)',
    elevation: 8,
    shadowColor: '#4A122E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 36,
  },
  iconActiveBg: {
    position: 'absolute',
    width: 44,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FCEBF1',
    borderWidth: 1,
    borderColor: 'rgba(217, 20, 90, 0.12)',
    top: 1,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.action,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  interestBadge: { backgroundColor: colors.primaryDark },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  profileAlertDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
});
