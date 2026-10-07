import React from 'react';
import { act, create } from 'react-test-renderer';
import { AnimatedSplash } from '../src/screens/AnimatedSplash';

jest.mock('react-native-bootsplash', () => ({ hide: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/components/LogoMark', () => {
  const { View } = require('react-native');
  return { LogoMark: View };
});
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: (value: number) => value,
    withDelay: (_delay: number, value: number) => value,
    withSpring: (value: number) => value,
    cancelAnimation: jest.fn(),
    Easing: { out: (value: unknown) => value, ease: jest.fn(), quad: jest.fn() },
  };
});

test('leaving the animated splash cancels delayed navigation', async () => {
  jest.useFakeTimers();
  const navigation = { replace: jest.fn() };
  let tree!: ReturnType<typeof create>;
  try {
    await act(async () => { tree = create(<AnimatedSplash navigation={navigation} />); });
    await act(async () => { tree.unmount(); });
    await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
    expect(navigation.replace).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
