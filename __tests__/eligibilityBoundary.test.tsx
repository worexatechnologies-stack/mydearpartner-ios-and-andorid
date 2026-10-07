import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AppState, AppStateStatus, FlatList, Text } from 'react-native';
import EligibilityBoundary from '../src/components/EligibilityBoundary';
import { useAuth } from '../src/context/AuthContext';
import { get, post } from '../src/api/apiClient';
import legal from '../src/config/legal.json';

jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../src/components/SafetyCenter', () => () => null);

let tree: ReactTestRenderer;
const childMounted = jest.fn();
function ProtectedContent() {
  childMounted();
  return <Text>Member profiles</Text>;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  (useAuth as jest.Mock).mockReturnValue({
    currentUser: { id: 'adult' },
    logout: jest.fn(),
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
async function mount() {
  await act(async () => {
    tree = create(
      <EligibilityBoundary>
        <ProtectedContent />
      </EligibilityBoundary>,
    );
  });
}
test('network failure cannot mount protected content', async () => {
  (get as jest.Mock).mockRejectedValue(new Error('offline'));
  await mount();
  expect(childMounted).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Unable to check account eligibility',
  );
});
test('old acceptance and ineligible accounts cannot mount protected content', async () => {
  (get as jest.Mock).mockResolvedValue({
    eligible: true,
    policy_version: 'old',
  });
  await mount();
  expect(childMounted).not.toHaveBeenCalled();
});
test('server-confirmed current eligibility permits access', async () => {
  (get as jest.Mock).mockResolvedValue({
    eligible: true,
    policy_version: legal.version,
  });
  await mount();
  expect(childMounted).toHaveBeenCalled();
});

test('missing eligibility endpoint never grants local approval', async () => {
  (get as jest.Mock).mockRejectedValue({ status: 404 });
  (post as jest.Mock).mockRejectedValue({ status: 404 });
  await mount();
  expect(childMounted).not.toHaveBeenCalled();
  await act(async () => {
    tree.root.findAllByProps({ accessibilityRole: 'checkbox' })[0].props.onPress();
  });
  await act(async () => {
    const continueButton = tree.root.findAllByProps({ accessibilityLabel: 'Confirm age and continue' })[0];
    expect(continueButton).toBeDefined();
    await continueButton.props.onPress();
  });
  expect(post).toHaveBeenCalled();
  expect(childMounted).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Eligibility could not be confirmed');
});

test('foreground revalidation removes protected content while the server check is pending', async () => {
  let foreground!: (state: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback;
    return { remove: jest.fn() };
  });
  try {
    (get as jest.Mock).mockResolvedValueOnce({ eligible: true, policy_version: legal.version });
    await mount();
    expect(JSON.stringify(tree.toJSON())).toContain('Member profiles');
    let finish!: (value: unknown) => void;
    (get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => foreground('active'));
    expect(JSON.stringify(tree.toJSON())).not.toContain('Member profiles');
    await act(async () => finish({ eligible: false, policy_version: legal.version }));
    expect(JSON.stringify(tree.toJSON())).not.toContain('Member profiles');
  } finally {
    listener.mockRestore();
  }
});


test('date wheels avoid nested virtualized lists and retain snapped selection', async () => {
  (get as jest.Mock).mockResolvedValue({ eligible: false, policy_version: legal.version });
  await mount();
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  const dayWheel = tree.root.findByProps({ accessibilityLabel: 'Day picker' });
  await act(async () => {
    dayWheel.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 56 * 14 } } });
  });
  expect(JSON.stringify(tree.toJSON())).toContain('15/');
});

test('missing server route explains that eligibility service requires an update', async () => {
  (get as jest.Mock).mockRejectedValue({ status: 404 });
  await mount();
  expect(childMounted).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Account eligibility is not available on the server yet');
});
