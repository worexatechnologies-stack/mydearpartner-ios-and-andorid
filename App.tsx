import AppErrorBoundary from './src/components/AppErrorBoundary';
import MemberAgeBoundary from './src/components/MemberAgeBoundary';
import { startNotificationRealtime } from './src/services/NotificationRealtimeService';
import { colors } from './src/theme/theme';
/**
 * MyDearPartner
 * A matrimony/matchmaking React Native app.
 *
 * @format
 */

import { DefaultTheme,NavigationContainer } from '@react-navigation/native';
import React,{ useEffect } from 'react';
import { StatusBar,StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import InAppNotification from './src/components/InAppNotification';
import { AppDataProvider } from './src/context/AppDataContext';
import { AuthProvider,useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { handleIncomingPush } from './src/services/IncomingPushService';
import {
  ensureChannels,
  handleInitialNotification,
  handleNotificationPress,
  requestPermission,
  setupNotifeeForegroundHandler,
} from './src/services/PushNotificationService';
import analyticsService from './src/services/analyticsService';

const customDefaultTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const linking = {
  prefixes: ['mydearpartner://'],
  config: {
    screens: {
      ProfileDetail: 'profile/:profileId',
    },
  },
};

function SessionDataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const crashMod = require('@react-native-firebase/crashlytics');
        const getCrashlytics = typeof crashMod === 'function' ? crashMod : crashMod?.default;
        if (typeof getCrashlytics === 'function') {
          getCrashlytics().setUserId(currentUser.id);
        }
      } catch {
        // Crashlytics native module is optional in local debug builds
      }
      return startNotificationRealtime();
    }
  }, [currentUser?.id]);
  return <AppDataProvider key={currentUser?.id ?? 'signed-out'}>{children}</AppDataProvider>;
}

function App() {
  useEffect(() => {
    // Initialize analytics pipeline (tracks first_open once)
    analyticsService.init().catch(() => {});

    // Ensure system notification channels and permissions are ready
    ensureChannels().catch(err =>
      console.warn('[App] ensureChannels error:', err),
    );
    requestPermission().catch(err =>
      console.warn('[App] requestPermission error:', err),
    );

    // Listen for Notifee local/system notification taps
    const unsubNotifee = setupNotifeeForegroundHandler();
    handleInitialNotification().catch(() => {});

    // Listen for FCM messages received in the foreground
    let active = true;
    let unsubFcm: (() => void) | undefined;
    let unsubOpen: (() => void) | undefined;

    try {
      const {
        getMessaging,
        onMessage,
        onNotificationOpenedApp,
        getInitialNotification,
      } = require('@react-native-firebase/messaging');
      const messaging = getMessaging();

      unsubFcm = onMessage(messaging, (remoteMessage: any) =>
        handleIncomingPush(remoteMessage, true),
      );

      // Handle notification opened from background (app was backgrounded, not killed)
      unsubOpen = onNotificationOpenedApp(messaging, (remoteMessage: any) => {

        const notifData =
          remoteMessage?.data ?? remoteMessage?.notification ?? {};
        if (Object.keys(notifData).length > 0) {
          handleNotificationPress(notifData);
        }
      });

      // Handle notification that opened the app from a killed state
      getInitialNotification(messaging).then((remoteMessage: any) => {
        if (active && remoteMessage) {

          const notifData =
            remoteMessage?.data ?? remoteMessage?.notification ?? {};
          if (Object.keys(notifData).length > 0) {
            handleNotificationPress(notifData);
          }
        }
      }).catch(() => { /* A missing launch notification does not block startup. */ });
    } catch (err) {
      console.warn('[App] Firebase Messaging listeners error:', err);
    }

    return () => {
      active = false;
      unsubNotifee?.();
      unsubFcm?.();
      unsubOpen?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AppErrorBoundary>
        <AuthProvider>
          <MemberAgeBoundary>
          <SessionDataProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={customDefaultTheme}
              linking={linking}
            >
              <RootNavigator />
            </NavigationContainer>
            <InAppNotification />
          </SessionDataProvider>
          </MemberAgeBoundary>
        </AuthProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default App;
