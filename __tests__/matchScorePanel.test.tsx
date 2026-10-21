import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import CompatibilityBreakdownModal from '../src/components/CompatibilityBreakdownModal';
import GeminiHoroscopeModal from '../src/components/GeminiHoroscopeModal';
import { getMatchCapabilities, getMatchInsights } from '../src/api/matchmakingService';
import { calculateGeminiHoroscopeMatch } from '../src/services/geminiHoroscopeService';
import { Profile } from '../src/types/models';
jest.mock('../src/api/matchmakingService', () => ({
  ...jest.requireActual('../src/api/matchmakingService'),
  getMatchCapabilities: jest.fn().mockResolvedValue({ service: 'match-insights', version: 1, aiConfigured: true }),
  getMatchInsights: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
const mine = { id: 'me', name: 'Me', city: 'Bengaluru' } as Profile;
const theirs = { id: 'other', name: 'Alex', city: 'Bengaluru', compatibilityScore: 75 } as Profile;
let tree: Renderer.ReactTestRenderer;
const text = () => tree.root.findAllByType(Text).flatMap(node => node.props.children).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); jest.clearAllMocks(); });
test('score details show the reported percentage and factual context without AI controls', async () => {
  await act(async () => { tree = Renderer.create(<CompatibilityBreakdownModal visible onClose={jest.fn()} myProfile={mine} theirProfile={theirs} />); });
  expect(text()).toContain('Match score');
  expect(text()).toContain('75%');
  expect(text()).toContain('Profile facts for comparison');
  expect(text()).toContain('not a calculated breakdown');
  expect(text()).not.toContain('Request AI insights');
  expect(text()).not.toContain('Conversation starters');
  expect(getMatchCapabilities).not.toHaveBeenCalled();
  expect(getMatchInsights).not.toHaveBeenCalled();
});
test('unknown scores remain unknown instead of falling back to 75', async () => {
  await act(async () => { tree = Renderer.create(<CompatibilityBreakdownModal visible onClose={jest.fn()} theirProfile={{ ...theirs, compatibilityScore: undefined }} />); });
  expect(text()).toContain('Not available');
  expect(text()).not.toContain('75%');
});
test('insights focus on conversation and optional AI rather than repeating score details', async () => {
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal visible onClose={jest.fn()} myProfile={mine} theirProfile={theirs} analysis={calculateGeminiHoroscopeMatch(mine, theirs)} />); });
  expect(text()).toContain('Conversation starters');
  expect(text()).toContain('Request AI insights');
  expect(text()).not.toContain('75%');
  expect(text()).not.toContain('Profile facts for comparison');
});
