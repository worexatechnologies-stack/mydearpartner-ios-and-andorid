import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from '../src/services/analyticsService';
import { logEvent } from '@react-native-firebase/analytics';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return { __esModule: true, default: {
    clear: jest.fn(async () => values.clear()),
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  } };
});

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('first-open marker is saved only after successful transport', async () => {
  (logEvent as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await analyticsService.trackFirstOpen();
  expect(await AsyncStorage.getItem('@mdp_analytics_first_open_logged')).toBeNull();
  (logEvent as jest.Mock).mockResolvedValueOnce(undefined);
  await analyticsService.trackFirstOpen();
  expect(logEvent).toHaveBeenLastCalledWith({}, 'app_first_open', expect.any(Object));
  expect(await AsyncStorage.getItem('@mdp_analytics_first_open_logged')).toBe('true');
  await analyticsService.trackFirstOpen();
  expect(logEvent).toHaveBeenCalledTimes(2);
});

test('message event contains no message contents or participant IDs', async () => {
  (logEvent as jest.Mock).mockResolvedValueOnce(undefined);
  await analyticsService.trackConversationStarted();
  expect(logEvent).toHaveBeenCalledWith({}, 'conversation_started', {});
});
