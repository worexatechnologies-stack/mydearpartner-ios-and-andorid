/**
 * Central design tokens for the MyDearPartner app.
 * Warm ivory surfaces, rich plum typography, and accessible rose accents.
 */
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const colors = {
  // Brand
  primary: '#A53760',
  primaryDark: '#772544',
  primaryLight: '#F9EAF0',

  secondary: '#BB5278',
  secondaryLight: '#F1DCE5',

  // Background & Surface - Ultra Clean
  background: '#FFF8FA',
  action: '#D9145A',
  actionDark: '#B9104B',
  surfaceTint: '#FFF0F5',
  roseBorder: '#F0DFE7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text - High contrast hierarchy
  text: '#302432',
  textSecondary: '#706574',
  textTertiary: '#857887',
  textLight: '#706574',
  textInverse: '#FFFFFF',

  // States & Borders
  border: '#E9E2E6',
  divider: '#F3EEF1',

  // Luxury Warm Accents
  gold: '#D4AF37',
  goldLight: '#FDF7E7',
  goldMuted: '#E9B44C',
  goldBorder: '#F3E2B8',
  goldInk: '#6B4E00',

  // Glassmorphism & Scrim
  glass: 'rgba(255, 255, 255, 0.88)',
  glassBorder: 'rgba(255, 255, 255, 0.4)',
  glassDark: 'rgba(26, 7, 18, 0.82)',
  scrimDark: 'rgba(26, 7, 18, 0.88)',
  scrimLight: 'rgba(26, 7, 18, 0.2)',
  plumDark: '#260A1D',
  plumDeep: '#1A0712',
  roseGlow: 'rgba(217, 20, 90, 0.18)',

  // Semantic
  success: '#10B981', // Modern emerald green
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Utilities
  overlay: 'rgba(38, 10, 29, 0.72)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Gradients
  gradientPrimary: ['#99254F', '#701938'],
  gradientLuxury: ['#4A122E', '#240A18'],
  gradientRose: ['#FF2D78', '#D9145A'],
  gradientDark: ['#52334F', '#302432'],
  gradientGold: ['#F5C542', '#D4AF37'],
  gradientGlass: ['rgba(255, 255, 255, 0.94)', 'rgba(255, 255, 255, 0.78)'],
  gradientCardScrim: [
    'transparent',
    'rgba(26, 7, 18, 0.15)',
    'rgba(26, 7, 18, 0.88)',
  ],
};

export const lightColors = colors;

export const useTheme = () => {
  return {
    colors: lightColors,
    isDark: false,
    styles: {
      text: { color: lightColors.text },
      textSecondary: { color: lightColors.textSecondary },
      background: { backgroundColor: lightColors.background },
      surface: { backgroundColor: lightColors.surface },
      border: { borderColor: lightColors.border },
    },
  };
};

// Generous, modern spacing
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
  massive: 80,
};

// Modern, bold typography scale
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 44,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
};

export const typeScale = {
  display: {
    fontSize: typography.sizes.display,
    lineHeight: 52,
    fontWeight: typography.weights.heavy,
    color: colors.text,
    letterSpacing: -1,
  },
  title: {
    fontSize: typography.sizes.xxl,
    lineHeight: 32,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    lineHeight: 26,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  body: {
    fontSize: typography.sizes.md,
    lineHeight: 24,
    fontWeight: typography.weights.regular,
    color: colors.text,
  },
  caption: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    fontWeight: typography.weights.medium,
    color: colors.textTertiary,
  },
};

export const fontSizes = typography.sizes;

// Rounded cards, restrained controls, and pill badges.
export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 32,
  pill: 999,
};

// Ultra-soft, diffuse shadows (Glassmorphism style)
export const shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.1,
      shadowRadius: 32,
    },
    android: { elevation: 12 },
    default: {},
  }),
  button: Platform.select({
    ios: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  card: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
    },
    android: { elevation: 4 },
    default: {},
  }),
  glass: Platform.select({
    ios: {
      shadowColor: '#4A122E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 2 },
    default: {},
  }),
  luxury: Platform.select({
    ios: {
      shadowColor: '#4A122E',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  }),
  floatingPill: Platform.select({
    ios: {
      shadowColor: '#5A1536',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
    },
    android: { elevation: 8 },
    default: {},
  }),
};

// Screen dimensions utility
export const screen = {
  width,
  height,
  isSmall: height < 700,
};

// Minimum interactive area shared by iOS and Android controls.
export const interaction = {
  targetSize: 48,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
};
