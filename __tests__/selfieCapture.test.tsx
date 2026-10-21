import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Modal, Text, TouchableOpacity } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import VerificationScreen from '../src/screens/member/VerificationScreen';
import { verificationService } from '../src/api/verificationService';

jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

jest.mock('../src/components/ScreenContainer', () => 'ScreenContainer');
jest.mock('../src/components/AppButton', () => 'AppButton');
jest.mock('../src/api/verificationService', () => ({
  verificationService: {
    getStatus: jest
      .fn()
      .mockResolvedValue({
        idVerified: false,
        selfieVerified: false,
        incomeVerified: false,
      }),
    submitSelfie: jest.fn().mockResolvedValue({ selfieVerified: false }),
  },
}));

const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
let tree: Renderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    tree = Renderer.create(
      <VerificationScreen
        navigation={{ goBack: jest.fn() } as any}
        route={{} as any}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

async function capture() {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(text => String(text.props.children).includes('Take Selfie')),
    )!;
  await act(async () => button.props.onPress());
  const actions = alert.mock.calls[0][2]!;
  await act(async () => {
    await actions.find(action => action.text === 'Open Camera')!.onPress!();
  });
}

test('opens the native front camera directly and submits the captured selfie for review', async () => {
  (launchCamera as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///selfie.jpg' }],
  });
  await capture();
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(launchCamera).toHaveBeenCalledWith(
    expect.objectContaining({ cameraType: 'front', mediaType: 'photo' }),
  );
  expect(verificationService.submitSelfie).toHaveBeenCalledWith(
    'file:///selfie.jpg',
  );
  expect(alert).toHaveBeenLastCalledWith(
    'Selfie Submitted',
    expect.stringContaining('review'),
  );
});
test.each([
  { didCancel: true },
  { errorCode: 'camera_unavailable' },
  { errorCode: 'permission' },
  { assets: [] },
])('never uploads a failed or cancelled capture: %j', async response => {
  (launchCamera as jest.Mock).mockResolvedValue(response);
  await capture();
  expect(verificationService.submitSelfie).not.toHaveBeenCalled();
});
test('handles native camera exceptions without leaving capture disabled', async () => {
  (launchCamera as jest.Mock).mockRejectedValue(new Error('Camera failed'));
  await capture();
  expect(alert).toHaveBeenLastCalledWith(
    'Selfie submission failed',
    'Camera failed',
  );
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(text => String(text.props.children).includes('Take Selfie')),
    )!;
  expect(button.props.disabled).toBe(false);
});
