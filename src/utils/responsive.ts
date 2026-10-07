/**
 * MyDearPartner — Responsive Design & Screen Auto-Sizing Utility
 *
 * Automatically scales layouts, fonts, paddings, and components across:
 * - Small screens (iPhone SE, 320dp–360dp Android devices)
 * - Standard phones (375dp–414dp)
 * - Large phones & Pro Max (428dp+)
 * - Foldables & Tablets (500dp+)
 */

import { Dimensions,useWindowDimensions } from 'react-native';

// Guideline dimensions based on standard mobile device (iPhone X/11/12/13/14 baseline)
const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

/**
 * Proportional horizontal scaling based on device width.
 */
export function scale(size: number, customWidth?: number): number {
  const currentWidth = customWidth ?? Dimensions.get('window').width;
  return (currentWidth / GUIDELINE_BASE_WIDTH) * size;
}

/**
 * Proportional vertical scaling based on device height.
 */
export function verticalScale(size: number, customHeight?: number): number {
  const currentHeight = customHeight ?? Dimensions.get('window').height;
  return (currentHeight / GUIDELINE_BASE_HEIGHT) * size;
}

/**
 * Moderate scaling for fonts and paddings with a dampening factor.
 * Factor 0 = fixed size, factor 1 = full proportional scaling. Default: 0.5.
 */
export function moderateScale(
  size: number,
  factor = 0.5,
  customWidth?: number,
): number {
  return size + (scale(size, customWidth) - size) * factor;
}

/**
 * Bounded responsive font size that prevents text from clipping on small devices
 * and from blowing up too large on tablets.
 */
export function responsiveFontSize(
  size: number,
  factor = 0.4,
  customWidth?: number,
): number {
  const currentWidth = customWidth ?? Dimensions.get('window').width;
  const scaled = moderateScale(size, factor, currentWidth);
  const minSize = Math.round(size * 0.85);
  const maxSize = Math.round(size * 1.3);
  return Math.min(Math.max(scaled, minSize), maxSize);
}

/**
 * Percentage of screen width (0 to 100).
 */
export function widthPercentage(percent: number, customWidth?: number): number {
  const currentWidth = customWidth ?? Dimensions.get('window').width;
  return (currentWidth * percent) / 100;
}

/**
 * Percentage of screen height (0 to 100).
 */
export function heightPercentage(
  percent: number,
  customHeight?: number,
): number {
  const currentHeight = customHeight ?? Dimensions.get('window').height;
  return (currentHeight * percent) / 100;
}

/**
 * Standard device classifiers (synchronous snapshot)
 */
export const deviceMetrics = {
  get width() {
    return Dimensions.get('window').width;
  },
  get height() {
    return Dimensions.get('window').height;
  },
  get isSmallDevice() {
    return Dimensions.get('window').width < 375;
  },
  get isNarrowDevice() {
    return Dimensions.get('window').width < 350;
  },
  get isTablet() {
    const { width, height } = Dimensions.get('window');
    const aspectRatio = height / width;
    return width >= 600 || (width >= 500 && aspectRatio < 1.4);
  },
  get isLargePhone() {
    return Dimensions.get('window').width >= 414;
  },
  get maxContentWidth() {
    const { width } = Dimensions.get('window');
    return Math.min(width, 520);
  },
};

/**
 * React Hook for dynamic responsive layouts that react to orientation changes,
 * split screen, and foldable unfoldings in real time.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallDevice = width < 375;
  const isNarrowDevice = width < 350;
  const isTablet = width >= 600 || (width >= 500 && height / width < 1.4);
  const isLargePhone = width >= 414 && !isTablet;
  const contentWidth = Math.min(width, isTablet ? 560 : width);

  return {
    width,
    height,
    isLandscape,
    isSmallDevice,
    isNarrowDevice,
    isTablet,
    isLargePhone,
    contentWidth,
    scale: (size: number) => scale(size, width),
    verticalScale: (size: number) => verticalScale(size, height),
    moderateScale: (size: number, factor = 0.5) =>
      moderateScale(size, factor, width),
    rf: (size: number, factor = 0.4) => responsiveFontSize(size, factor, width),
    wp: (percent: number) => (width * percent) / 100,
    hp: (percent: number) => (height * percent) / 100,
  };
}

// Convenient shorthand exports
export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;
export const rf = responsiveFontSize;
export const wp = widthPercentage;
export const hp = heightPercentage;
