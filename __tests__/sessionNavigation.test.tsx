import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
import { SessionNavigation } from '../App';
import SplashScreen from '../src/screens/SplashScreen';
import { loadResumeState, saveResumeState } from '../src/navigation/resumeState';
import * as navigation from '../src/navigation/navigationRef';

let mockAuth: any;
let mockNavigationProps: any;
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../src/navigation/RootNavigator', () => 'RootNavigator');
jest.mock('../src/screens/SplashScreen', () => 'SplashScreen');
jest.mock('../src/screens/ProcessingScreen', () => 'ProcessingScreen');
jest.mock('../src/navigation/resumeState', () => ({
  loadResumeState: jest.fn(), saveResumeState: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/navigation/navigationRef', () => ({
  __esModule: true,
  navigationRef: { isReady: jest.fn(() => true), getRootState: jest.fn() },
  pendingDeepLink: null,
  consumePendingDeepLink: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  NavigationContainer: require('react').forwardRef((props: any, _ref: any) => {
    mockNavigationProps = props;
    return props.children;
  }),
}));

let tree: ReactTestRenderer;
const saved = { index: 1, routes: [{ name: 'Main' }, { name: 'EditProfile' }] };
beforeEach(() => {
  mockAuth = { isLoading: false, currentUser: { id: 'alice', profileComplete: true } };
  mockNavigationProps = undefined;
  (navigation as any).pendingDeepLink = null;
  (loadResumeState as jest.Mock).mockReset().mockResolvedValue(saved);
  (saveResumeState as jest.Mock).mockClear();
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

async function launch() {
  await act(async () => { tree = create(<SessionNavigation />); });
  await act(async () => tree.root.findByType(SplashScreen).props.onComplete());
}

test('restores only after authentication and saves navigation under the authenticated account', async () => {
  mockAuth.isLoading = true;
  await launch();
  expect(loadResumeState).not.toHaveBeenCalled();
  expect(mockNavigationProps).toBeUndefined();
  mockAuth = { ...mockAuth, isLoading: false };
  await act(async () => tree.update(<SessionNavigation />));
  expect(mockNavigationProps.initialState).toEqual(saved);
  mockNavigationProps.onStateChange(saved);
  expect(saveResumeState).toHaveBeenCalledWith('alice', saved);
});

test.each(['url', 'notification'])('%s launch takes priority over the saved screen', async source => {
  if (source === 'url') (Linking.getInitialURL as jest.Mock).mockResolvedValue('mydearpartner://profile/bob');
  else (navigation as any).pendingDeepLink = { name: 'Notifications' };
  await launch();
  expect(mockNavigationProps.initialState).toBeUndefined();
  mockNavigationProps.onReady();
  expect(navigation.consumePendingDeepLink).toHaveBeenCalled();
});

test('signed-out sessions never restore or save member navigation', async () => {
  mockAuth.currentUser = null;
  await launch();
  expect(loadResumeState).not.toHaveBeenCalled();
  expect(mockNavigationProps.initialState).toBeUndefined();
  mockNavigationProps.onStateChange(saved);
  expect(saveResumeState).not.toHaveBeenCalled();
});
