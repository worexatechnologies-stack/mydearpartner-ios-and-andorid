import { colors } from '../theme/theme';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import OfflineBanner from '../components/OfflineBanner';
import ChatsListScreen from '../screens/main/ChatsListScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import InterestsScreen from '../screens/main/InterestsScreen';
import MyProfileScreen from '../screens/main/MyProfileScreen';
import SearchScreen from '../screens/main/SearchScreen';
import { useAppStats } from '../hooks/useAppStats';

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
  const showBadge = routeName === 'Chats' && unreadCount > 0;
  const badgeText = unreadCount > 10 ? '10+' : String(unreadCount);
  const showInterestBadge =
    routeName === 'Interests' && pendingInterestsCount > 0;
  const interestBadgeText =
    pendingInterestsCount > 9 ? '9+' : String(pendingInterestsCount);
  const iconSize = isSmallScreen ? 22 : 24;

  return (
    <View style={styles.iconContainer}>
      {focused && <View style={styles.iconActiveBg} />}
      <View>
        <Icon
          name={focused ? config.icon : config.iconOutline}
          size={iconSize}
          color={color}
        />
      </View>
      {showBadge && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      )}
      {showInterestBadge && (
        <View style={[styles.badgeContainer, styles.interestBadge]}>
          <Text style={styles.badgeText}>{interestBadgeText}</Text>
        </View>
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
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: isSmallScreen ? 10 : 11,
            fontWeight: '700',
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
      <OfflineBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.roseBorder,
    elevation: 5,
    shadowColor: '#49313E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
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
    borderRadius: 13,
    backgroundColor: colors.surfaceTint,
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
