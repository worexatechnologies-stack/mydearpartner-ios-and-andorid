import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text, TextInput } from 'react-native';
import AppButton from '../src/components/AppButton';
import AppTextInput from '../src/components/AppTextInput';
import { colors } from '../src/theme/theme';

test('long button labels can shrink and wrap inside the available width', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await act(() => {
    tree = Renderer.create(<AppButton title="Continue with your account preferences" onPress={jest.fn()} />);
  });
  expect(StyleSheet.flatten(tree.root.findByType(Text).props.style).flexShrink).toBe(1);
  act(() => tree.unmount());
});

test('multiline fields reserve visible writing space and align text at the top', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await act(() => {
    tree = Renderer.create(<AppTextInput label="About you" multiline value="First line\nSecond line" />);
  });
  const input = tree.root.findByType(TextInput);
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ minHeight: 96, textAlignVertical: 'top', minWidth: 0 });
  expect(input.props.accessibilityLabel).toBe('About you');
  act(() => tree.unmount());
});

test('disabled secondary buttons retain readable text and block interaction', async () => {
  let root: Renderer.ReactTestRenderer;
  const onPress = jest.fn();
  await act(() => {
    root = Renderer.create(
      <AppButton
        title="Save changes"
        variant="secondary"
        disabled
        onPress={onPress}
      />,
    );
  });
  const button = root!.root.findAllByProps({ accessibilityRole: 'button' })[0];
  expect(button.props.accessibilityState.disabled).toBe(true);
  expect(
    StyleSheet.flatten(root!.root.findByType(Text).props.style).color,
  ).toBe(colors.primary);
  await act(() => root.unmount());
});
test('loading buttons retain an accessible name and busy state', async () => {
  let root: Renderer.ReactTestRenderer;
  await act(() => {
    root = Renderer.create(
      <AppButton title="Save changes" loading onPress={jest.fn()} />,
    );
  });
  const button = root!.root.findAllByProps({ accessibilityRole: 'button' })[0];
  expect(button.props.accessibilityLabel).toBe('Save changes');
  expect(button.props.accessibilityState).toEqual({
    disabled: true,
    busy: true,
  });
  await act(() => root.unmount());
});
