import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import RootNavigator from '../src/navigation/RootNavigator';
import SplashScreen from '../src/screens/SplashScreen';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ isLoading: true, currentUser: null }),
}));
jest.mock('../src/screens/SplashScreen', () => () => null);

test('startup displays splash while restoring the session instead of a blank screen', async () => {
  let tree!: ReactTestRenderer;
  await act(() => { tree = create(<RootNavigator />); });
  expect(tree.root.findAllByType(SplashScreen)).toHaveLength(1);
  await act(() => tree.unmount());
});
