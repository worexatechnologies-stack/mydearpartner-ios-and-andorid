import React from 'react';
import { Alert, TextInput } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import LoginScreen from '../src/screens/auth/LoginScreen';
import { saveSavedCredentials } from '../src/utils/credentialStorage';

const mockLogin = jest.fn();
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockCancel = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, verifyLoginOtp: mockVerify, resendLoginOtp: mockResend, cancelLogin: mockCancel }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/utils/credentialStorage', () => ({
  getSavedCredentials: jest.fn().mockResolvedValue(null),
  saveSavedCredentials: jest.fn().mockResolvedValue(true),
  clearSavedCredentials: jest.fn(),
}));

let tree: ReactTestRenderer;
const challenge = { requires_otp: true, challenge_id: 'first', phone_masked: '******3210' };
const button = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const input = (label: string) => tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockLogin.mockResolvedValue({ ok: false, challenge });
  mockVerify.mockResolvedValue({ ok: true });
  mockResend.mockResolvedValue({ ...challenge, challenge_id: 'second' });
  await act(async () => { tree = create(<LoginScreen />); });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function startChallenge() {
  await act(async () => {
    input('Member ID, email or mobile number').props.onChangeText('MDP123');
    input('Password').props.onChangeText('password');
  });
  await act(async () => { await button('Sign In').props.onPress(); });
}

test('ID and password open OTP entry, and credentials are saved only after verification', async () => {
  await startChallenge();
  expect(mockLogin).toHaveBeenCalledWith('MDP123', 'password');
  expect(saveSavedCredentials).not.toHaveBeenCalled();
  expect(button('Resend OTP').props.disabled).toBe(true);
  await act(async () => { await button('Verify OTP and sign in').props.onPress(); });
  expect(mockVerify).not.toHaveBeenCalled();
  await act(async () => input('Verification code').props.onChangeText('123456'));
  await act(async () => { await button('Verify OTP and sign in').props.onPress(); });
  expect(mockVerify).toHaveBeenCalledWith('123456');
  expect(saveSavedCredentials).toHaveBeenCalledWith('MDP123', 'password');
});

test('incorrect OTP keeps the challenge open and resend waits for the cooldown', async () => {
  await startChallenge();
  mockVerify.mockResolvedValue({ ok: false, error: 'Incorrect verification code.' });
  await act(async () => input('Verification code').props.onChangeText('111111'));
  await act(async () => { await button('Verify OTP and sign in').props.onPress(); });
  expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Incorrect verification code.');
  expect(saveSavedCredentials).not.toHaveBeenCalled();
  for (let seconds = 0; seconds < 60; seconds += 1) {
    await act(async () => { jest.advanceTimersByTime(1000); });
  }
  expect(button('Resend OTP').props.disabled).toBe(false);
  await act(async () => { await button('Resend OTP').props.onPress(); });
  expect(mockResend).toHaveBeenCalledTimes(1);
  expect(input('Verification code').props.value).toBe('');
  expect(button('Resend OTP').props.disabled).toBe(true);
});
