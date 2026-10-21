import { useState } from 'react';
import { LayoutChangeEvent, useWindowDimensions } from 'react-native';

export function searchGridLayout(width: number, fontScale = 1) {
  const availableWidth = Math.max(1, Math.min(width, 1100));
  const textScale = Math.max(1, fontScale);
  const columns = availableWidth < 350 || textScale > 1.3
    ? Math.max(1, Math.min(3, Math.floor((availableWidth - 16) / (220 * textScale + 12))))
    : availableWidth < 600
    ? 2
    : Math.max(2, Math.min(4, Math.floor((availableWidth - 16) / 232)));
  return {
    columns,
    cardWidth: Math.max(1, Math.floor((availableWidth - 28 - 12 * (columns - 1)) / columns)),
  };
}

/** Measure the content pane, including tablet split-screen and safe-area changes. */
export function useSearchGrid() {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  return {
    ...searchGridLayout(measuredWidth ?? width, fontScale),
    onLayout: (event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width),
  };
}
