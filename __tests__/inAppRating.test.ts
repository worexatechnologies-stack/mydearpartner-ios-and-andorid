import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { recordMatch } from '../src/utils/inAppRating';
import { checkForUpdate } from '../src/utils/forceUpdate';

jest.mock('../src/utils/forceUpdate', () => ({ checkForUpdate: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    clear: jest.fn(async () => { values.clear(); }),
  };
});
const storageKey = '@mydearpartner_rating_prompt';
const storeUrl = 'https://play.google.com/store/apps/details?id=com.mydearpartner';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (checkForUpdate as jest.Mock).mockResolvedValue({ updateUrl: storeUrl });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('a failed store launch does not permanently disable rating prompts', async () => {
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error('store unavailable'));
  await recordMatch();
  const rate = (Alert.alert as jest.Mock).mock.calls[0][2][2];
  await rate.onPress();
  expect(Linking.openURL).toHaveBeenCalledWith(storeUrl);
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!).hasRated).toBe(false);
  expect(Alert.alert).toHaveBeenLastCalledWith('Could not open the store', expect.any(String));
});

test('a successful store launch persists the rating opt-out', async () => {
  await recordMatch();
  await (Alert.alert as jest.Mock).mock.calls[0][2][2].onPress();
  expect(JSON.parse((await AsyncStorage.getItem(storageKey))!).hasRated).toBe(true);
  await recordMatch();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test.each([{ updateUrl: undefined }, { updateUrl: storeUrl, updateRequired: true }])(
  'does not prompt without a listing or during a mandatory update: %p', async config => {
    (checkForUpdate as jest.Mock).mockResolvedValue(config);
    await recordMatch();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(storageKey))!).promptCount).toBe(0);
  },
);
