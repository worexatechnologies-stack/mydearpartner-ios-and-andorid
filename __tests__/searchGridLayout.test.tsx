import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { searchGridLayout, useSearchGrid } from '../src/hooks/useSearchGrid';

let mockDimensions = { width: 1024, height: 768, fontScale: 1, scale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
}));

it.each([
  [320, 1, 1], [360, 1, 2], [600, 1, 2], [768, 1, 3],
  [1024, 1, 4], [1366, 1, 4], [768, 1.5, 2], [600, 2, 1],
])('fits cards within %s points at font scale %s', (width, fontScale, expectedColumns) => {
  const { columns, cardWidth } = searchGridLayout(width, fontScale);
  expect(columns).toBe(expectedColumns);
  expect(cardWidth * columns + 12 * (columns - 1) + 28).toBeLessThanOrEqual(Math.min(width, 1100));
  expect(cardWidth).toBeGreaterThan(0);
});

it('uses the measured pane rather than the full tablet window', async () => {
  let grid!: ReturnType<typeof useSearchGrid>;
  function Capture() { grid = useSearchGrid(); return null; }
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<Capture />); });
  expect(grid.columns).toBe(4);
  await act(async () => grid.onLayout({ nativeEvent: { layout: { width: 480 } } } as any));
  expect(grid.columns).toBe(2);
  expect(grid.cardWidth).toBe(220);
  await act(async () => grid.onLayout({ nativeEvent: { layout: { width: 320 } } } as any));
  expect(grid.columns).toBe(1);
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  await act(async () => { tree.update(<Capture />); });
  expect(grid.columns).toBe(1);
  await act(async () => tree.unmount());
});
