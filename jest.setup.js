/**
 * Jest setup for native module mocks used across the test suite.
 */
import '@react-native-async-storage/async-storage/jest';
import 'react-native-gesture-handler/jestSetup';

// Native Notifee is unavailable in the Jest runtime. Keep this mock limited to
// tests so notification behaviour in the installed app remains unchanged.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createChannel: jest.fn().mockResolvedValue('default'),
    getChannel: jest.fn().mockResolvedValue(null),
    displayNotification: jest.fn().mockResolvedValue('notification-id'),
    onForegroundEvent: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    cancelDisplayedNotifications: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: { HIGH: 4 },
  AuthorizationStatus: { AUTHORIZED: 1 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  getAPNSToken: jest.fn().mockResolvedValue('apns-token'),
  isDeviceRegisteredForRemoteMessages: jest.fn().mockResolvedValue(true),
  registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  onMessage: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock('react-native-quick-crypto', () => ({
  Buffer: require('buffer').Buffer,
  install: jest.fn(),
}));

jest.mock('react-native-base64', () => ({
  __esModule: true,
  default: {
    encode: value => require('buffer').Buffer.from(value, 'utf8').toString('base64'),
    decode: value => require('buffer').Buffer.from(value, 'base64').toString('utf8'),
  },
}));

jest.mock('react-native-vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name }) => React.createElement(Text, null, name);
});

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const { ScrollView } = require('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, ...props }: any) => React.createElement(View, props, children);
});

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  return {
    __esModule: true,
    useSharedValue: jest.fn((val) => ({ value: val })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn(x => x),
    withRepeat: jest.fn(x => x),
    withSequence: jest.fn(x => x),
    withSpring: jest.fn(x => x),
    withDelay: jest.fn((delay, x) => x),
    runOnJS: jest.fn(fn => fn),
    Easing: {
      bezier: jest.fn(),
      linear: jest.fn(),
      ease: jest.fn(),
      in: jest.fn(),
      out: jest.fn(),
      inOut: jest.fn(),
    },
    interpolate: jest.fn((val, inR, outR) => outR[0]),
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    useEvent: jest.fn(() => jest.fn()),
    useHandler: jest.fn(() => ({})),
    default: {
      createAnimatedComponent: jest.fn(Component => Component),
      View: 'View',
      Text: 'Text',
      Image: 'Image',
      ScrollView: 'ScrollView',
    },
  };
});

jest.mock('react-native-fast-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const FastImageComponent = (props: any) => React.createElement(View, props);
  FastImageComponent.displayName = 'FastImage';
  FastImageComponent.resizeMode = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  };
  FastImageComponent.priority = {
    low: 'low',
    normal: 'normal',
    high: 'high',
  };
  FastImageComponent.preload = jest.fn();
  FastImageComponent.clearMemoryCache = jest.fn().mockResolvedValue(undefined);
  FastImageComponent.clearDiskCache = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    default: FastImageComponent,
  };
});

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn().mockResolvedValue(undefined),
}));
