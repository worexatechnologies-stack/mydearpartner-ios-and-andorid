import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useLatestCallback } from '../src/hooks/useLatestCallback';

test('retains callback identity while using the latest committed state', async () => {
  let callback: (amount: number) => number = () => 0;
  function Harness({ value }: { value: number }) {
    callback = useLatestCallback((amount: number) => value + amount);
    return null;
  }
  let root: Renderer.ReactTestRenderer;
  await act(() => {
    root = Renderer.create(<Harness value={2} />);
  });
  const original = callback;
  expect(original(3)).toBe(5);
  await act(() => {
    root.update(<Harness value={10} />);
  });
  expect(callback).toBe(original);
  expect(original(3)).toBe(13);
  await act(() => root.unmount());
});
