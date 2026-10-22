import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Home,
  Search,
  Send,
  MessageCircle,
  CircleUser,
} from 'lucide-react-native';
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

type TabConfigItem = {
  label: string;
  renderIcon: (props: { focused: boolean; color: string }) => React.ReactNode;
};

const tabConfig: Record<keyof MainTabParamList, TabConfigItem> = {
  Discover: {
    label: 'Matches',
    renderIcon: ({ focused }) => (
      <Home
        size={22}
        color={focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
        fill={focused ? '#FFFFFF' : 'transparent'}
        strokeWidth={focused ? 2.5 : 2}
      />
    ),
  },
  Search: {
    label: 'Search',
    renderIcon: ({ focused }) => (
      <Search
        size={22}
        color={focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
        strokeWidth={focused ? 2.6 : 2}
      />
    ),
  },
  Interests: {
    label: 'Activity',
    renderIcon: ({ focused }) => (
      <Send
        size={21}
        color={focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
        fill={focused ? '#FFFFFF' : 'transparent'}
        strokeWidth={focused ? 2.4 : 2}
      />
    ),
  },
  Chats: {
    label: 'Chats',
    renderIcon: ({ focused }) => (
      <MessageCircle
        size={22}
        color={focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
        fill={focused ? '#FFFFFF' : 'transparent'}
        strokeWidth={focused ? 2.5 : 2}
      />
    ),
  },
  MyProfile: {
    label: 'Profile',
    renderIcon: ({ focused }) => (
      <CircleUser
        size={22}
        color={focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
        strokeWidth={focused ? 2.5 : 2}
      />
    ),
  },
};

function TabIcon({
  routeName,
  focused,
  unreadCount,
  pendingInterestsCount,
  hasProfileAlert,
}: {
  routeName: keyof MainTabParamList;
  focused: boolean;
  unreadCount: number;
  pendingInterestsCount: number;
  hasProfileAlert?: boolean;
}) {
  const config = tabConfig[routeName];
  const showBadge = routeName === 'Chats' && unreadCount > 0;
  const badgeText = unreadCount > 10 ? '10+' : String(unreadCount);
  const showInterestBadge =
    routeName === 'Interests' && pendingInterestsCount > 0;
  const interestBadgeText =
    pendingInterestsCount > 9 ? '9+' : String(pendingInterestsCount);

  return (
    <View style={styles.iconContainer}>
      <View style={[styles.iconWrapper, focused && styles.iconActivePill]}>
        {config.renderIcon({
          focused,
          color: focused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)',
        })}
        {showBadge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        {showInterestBadge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{interestBadgeText}</Text>
          </View>
        )}
        {routeName === 'MyProfile' && hasProfileAlert && (
          <View style={styles.profileAlertDot} />
        )}
      </View>
    </View>
  );
}

export default function MainTabNavigator() {
  const stats = useAppStats();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 600;
  const isSmallScreen = width < 360;

  // Floating dark pill dock dimensions
  const barWidth = isTablet
    ? Math.min(480, width - 64)
    : isSmallScreen
    ? width - 24
    : Math.min(380, width - 40);
  const barLeft = (width - barWidth) / 2;
  const tabBarHeight = 62;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.72)',
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarAccessibilityLabel: tabConfig[route.name].label,
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabBarHeight,
              bottom: Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) + 4,
              left: barLeft,
              right: barLeft,
              start: barLeft,
              end: barLeft,
              width: barWidth,
              paddingHorizontal: isSmallScreen ? 4 : 8,
              paddingBottom: 0,
            },
          ],
          tabBarItemStyle: {
            height: tabBarHeight,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 0,
            paddingBottom: 0,
          },
          tabBarIcon: ({ focused }) => (
            <TabIcon
              routeName={route.name as keyof MainTabParamList}
              focused={focused}
              unreadCount={stats.unreadChats}
              pendingInterestsCount={stats.pendingInterests}
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
    backgroundColor: 'rgba(22, 22, 26, 0.96)',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 40,
    borderRadius: 20,
    position: 'relative',
  },
  iconActivePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 14,
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#16161A',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  profileAlertDot: {
    position: 'absolute',
    top: 1,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#16161A',
  },
});
