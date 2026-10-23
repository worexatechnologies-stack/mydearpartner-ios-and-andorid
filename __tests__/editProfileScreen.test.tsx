import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import EditProfileScreen from '../src/screens/EditProfileScreen';
import AppButton from '../src/components/AppButton';
import { updateMyProfile } from '../src/api/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountStorageKey } from '../src/utils/storage';
import { readResumeValue } from '../src/utils/resumeStorage';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockProfile = {
  id: 'p',
  name: 'Test Member',
  city: 'Pune',
  religion: 'Hindu',
  interests: [],
  photos: [],
  websiteFields: { num_brothers: 0, pref_age_min: 24 },
};
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'account', profile: mockProfile },
    updateProfile: jest.fn(),
    refreshCurrentUser: mockRefresh,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('../src/components/AuthImage', () => 'AuthImage');
jest.mock('../src/components/AppButton', () => 'AppButton');
jest.mock('../src/api/profileService', () => ({
  getMyPhotos: jest.fn().mockResolvedValue({ photos: [], maxPhotos: 5 }),
  updateMyProfile: jest.fn().mockResolvedValue({ id: 'p' }),
}));
jest.mock('../src/api/authService', () => ({ sendOtp: jest.fn() }));
jest.mock('../src/api/apiClient', () => ({ post: jest.fn() }));

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it('renders website tabs, retains edits between tabs, and saves only changed supported fields', async () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <EditProfileScreen navigation={navigation as any} route={{} as any} />,
    );
  });
  const tab = (name: string) =>
    tree.root
      .findAllByType(TouchableOpacity)
      .find(
        node =>
          node.props.accessibilityRole === 'tab' &&
          node.findByType(Text).props.children === name,
      )!;
  expect(
    tree.root
      .findAllByType(TouchableOpacity)
      .filter(node => node.props.accessibilityRole === 'tab'),
  ).toHaveLength(7);
  const city = tree.root
    .findAllByType(TextInput)
    .find(node => node.props.value === 'Pune')!;
  await act(async () => city.props.onChangeText('Chennai'));
  await act(async () => tab('Preferences').props.onPress());
  const age = tree.root
    .findAllByType(TextInput)
    .find(node => node.props.value === '24')!;
  await act(async () => age.props.onChangeText('26'));
  await act(async () => tab('Basic').props.onPress());
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(node => node.props.value === 'Chennai'),
  ).toBe(true);
  const save = tree.root
    .findAllByType(AppButton)
    .find(node => node.props.title === 'Save Profile')!;
  await act(async () => save.props.onPress());
  expect(updateMyProfile).toHaveBeenCalledWith({
    work_location: 'Chennai',
    pref_age_min: 26,
  });
  expect(mockRefresh).toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('restores an interrupted profile edit and removes the draft after saving', async () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  let tree!: Renderer.ReactTestRenderer;
  const mount = async () => {
    await act(async () => {
      tree = Renderer.create(<EditProfileScreen navigation={navigation as any} route={{} as any} />);
    });
  };
  await mount();
  const city = tree.root.findAllByType(TextInput).find(node => node.props.value === 'Pune')!;
  act(() => city.props.onChangeText('Mumbai'));
  await act(async () => tree.unmount());
  await mount();
  expect(tree.root.findAllByType(TextInput).some(node => node.props.value === 'Mumbai')).toBe(true);
  const save = tree.root.findAllByType(AppButton).find(node => node.props.title === 'Save Profile')!;
  (updateMyProfile as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await act(async () => save.props.onPress());
  expect(await readResumeValue(accountStorageKey('@mdp/profile-draft-v1', 'account'))).toEqual({ work_location: 'Mumbai' });
  await act(async () => save.props.onPress());
  expect(updateMyProfile).toHaveBeenLastCalledWith({ work_location: 'Mumbai' });
  expect(await readResumeValue(accountStorageKey('@mdp/profile-draft-v1', 'account'))).toBeNull();
  await act(async () => tree.unmount());
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    clear: jest.fn(async () => { values.clear(); }),
  };
});
