import React from 'react';
import { act, create } from 'react-test-renderer';
import { Animated } from 'react-native';
import SplashScreen from '../src/screens/SplashScreen';

jest.mock('../src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

test('preview completes eventually', async () => {
  const onComplete = jest.fn();
  jest.useFakeTimers();
  let tree!: ReturnType<typeof create>;
  
  await act(async () => {
    tree = create(<SplashScreen onComplete={onComplete} />);
  });
  
  // Fast forward the setTimeout fallback
  await act(async () => {
    jest.runAllTimers();
  });
  
  expect(onComplete).toHaveBeenCalledTimes(1);
  
  await act(async () => tree.unmount());
  jest.useRealTimers();
});
