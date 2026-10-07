import { useState } from 'react';
import { LayoutChangeEvent, useWindowDimensions } from 'react-native';

// Keep one card per viewport; allow taller cards to scroll when text or landscape
// leaves too little room for a readable photo, details, and action controls.
export function profilePageSize(viewportHeight: number, fontScale = 1) {
  const minimumHeight = 300 * Math.max(1, fontScale);
  return viewportHeight > 0
    ? Math.max(viewportHeight, minimumHeight)
    : minimumHeight;
}

export function useProfilePager() {
  const [viewportHeight, setViewportHeight] = useState(0);
  const { fontScale } = useWindowDimensions();
  const pageHeight = profilePageSize(viewportHeight, fontScale);
  return {
    pageHeight,
    pagingEnabled: viewportHeight >= pageHeight,
    onLayout: ({ nativeEvent }: LayoutChangeEvent) =>
      setViewportHeight(nativeEvent.layout.height),
  };
}
