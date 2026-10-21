import React from 'react';
import { act, create } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import SplashScreen from '../src/screens/SplashScreen';
import { useReducedMotion } from '../src/hooks/useReducedMotion';

jest.mock('../src/hooks/useReducedMotion');
const mockedUseReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;

describe('Ultra-Modern 2026 SplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseReducedMotion.mockReturnValue(false);
  });

  test('renders 2026 brand typography, tagline and official logo', async () => {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<SplashScreen />);
    });

    const root = tree.root;

    // Check Official Logo
    const images = root.findAllByType(Image);
    expect(images.length).toBeGreaterThanOrEqual(1);

    // Check Brand Title & Tagline
    const texts = root.findAllByType(Text).map(t => t.props.children);
    const flattenedText = texts
      .flat(2)
      .filter(item => typeof item === 'string')
      .join(' ');

    expect(flattenedText).toContain('My Dear');
    expect(flattenedText).toContain('Partner');
    expect(flattenedText).toContain('Meaningful Connections. Beautiful Beginnings.');

    // Check refined loading accessibility role
    const progressbar = root.findByProps({ accessibilityRole: 'progressbar' });
    expect(progressbar).toBeDefined();

    await act(async () => tree.unmount());
  });

  test('animates and completes cleanly within startup timeout', async () => {
    const onComplete = jest.fn();
    jest.useFakeTimers();
    let tree!: ReturnType<typeof create>;

    await act(async () => {
      tree = create(<SplashScreen onComplete={onComplete} />);
    });

    // Run timers through sequence completion
    await act(async () => {
      jest.runAllTimers();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    await act(async () => tree.unmount());
    jest.useRealTimers();
  });

  test('respects reduced-motion setting for accessibility', async () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    jest.useFakeTimers();
    let tree!: ReturnType<typeof create>;

    await act(async () => {
      tree = create(<SplashScreen onComplete={onComplete} />);
    });

    // Advance by the quick reduced-motion delay (250ms)
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    await act(async () => tree.unmount());
    jest.useRealTimers();
  });
});
