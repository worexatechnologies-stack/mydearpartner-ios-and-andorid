import React from 'react';
import { act, create } from 'react-test-renderer';
import { Animated } from 'react-native';
import SplashScreen from '../src/screens/SplashScreen';

jest.mock('../src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

test('preview completes after its animation and cancels animation on unmount', async () => {
  const onComplete = jest.fn();
  const stop = jest.fn();
  let finish!: (result: { finished: boolean }) => void;
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
    start: callback => {
      finish = callback!;
    },
    stop,
    reset: jest.fn(),
  });
  let tree!: ReturnType<typeof create>;
  try {
    await act(async () => {
      tree = create(<SplashScreen onComplete={onComplete} />);
    });
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 5800, useNativeDriver: true }),
    );
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => finish({ finished: false }));
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => finish({ finished: true }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    expect(stop).toHaveBeenCalledTimes(1);
  } finally {
    timing.mockRestore();
  }
});
