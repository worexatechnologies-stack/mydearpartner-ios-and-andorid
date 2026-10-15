import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState, useCallback } from 'react';
import ConnectionErrorScreen from '../screens/ConnectionErrorScreen';
import { useAuth } from '../context/AuthContext';
import ChatScreen from '../screens/ChatScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ProfileDetailScreen from '../screens/ProfileDetailScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import SplashScreen from '../screens/SplashScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import BlockedScreen from '../screens/member/BlockedScreen';
import CompareScreen from '../screens/member/CompareScreen';
import MembershipScreen from '../screens/member/MembershipScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';
import SettingsScreen from '../screens/member/SettingsScreen';
import VerificationScreen from '../screens/member/VerificationScreen';
import VisitorsScreen from '../screens/member/VisitorsScreen';
import { colors } from '../theme/theme';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import { consumePendingDeepLink, pendingDeepLink } from './navigationRef';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [splashComplete, setSplashComplete] = useState(false);
  const finishSplash = useCallback(() => setSplashComplete(true), []);
  const { isLoading, currentUser, sessionError, retrySession } = useAuth();

  useEffect(() => {
    // If we're fully logged in and have a pending link, process it
    if (
      splashComplete &&
      !isLoading &&
      currentUser?.profileComplete &&
      pendingDeepLink
    ) {
      // Small delay to ensure navigator layout is complete
      const timer = setTimeout(() => {
        consumePendingDeepLink();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [splashComplete, isLoading, currentUser?.profileComplete]);

  if (!splashComplete) {
    return <SplashScreen onComplete={finishSplash} />;
  }

  if (isLoading) {
    return <ProcessingScreen />;
  }

  if (sessionError) {
    return (
      <ConnectionErrorScreen onRetry={retrySession} error={sessionError} />
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      {!currentUser ? (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false }}
        />
      ) : !currentUser.profileComplete ? (
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProfileDetail"
            component={ProfileDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen
            name="Membership"
            component={MembershipScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Compare"
            component={CompareScreen}
            options={{ title: 'Compare Profiles' }}
          />
          <Stack.Screen
            name="Visitors"
            component={VisitorsScreen}
            options={{ title: 'Recent Visitors' }}
          />
          <Stack.Screen
            name="Verification"
            component={VerificationScreen}
            options={{ title: 'Trust & Verification' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="Blocked"
            component={BlockedScreen}
            options={{ title: 'Blocked Profiles' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
