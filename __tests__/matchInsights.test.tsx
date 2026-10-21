import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import GeminiHoroscopeModal from '../src/components/GeminiHoroscopeModal';
import AppButton from '../src/components/AppButton';
import { getMatchCapabilities, getMatchInsights } from '../src/api/matchmakingService';
import { calculateGeminiHoroscopeMatch } from '../src/services/geminiHoroscopeService';
import { Profile } from '../src/types/models';
jest.mock('../src/api/matchmakingService', () => ({
  ...jest.requireActual('../src/api/matchmakingService'),
  getMatchCapabilities: jest.fn(), getMatchInsights: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
const a = { id: 'a', name: 'Me', city: 'Bengaluru' } as Profile;
const b = { id: 'b', name: 'Match', city: 'Bengaluru' } as Profile;
const result = { candidateId: 'b', compatibilityScore: 100, isAiEnhanced: false, summary: 'Shared city', explanation: 'Based on supplied facts', sharedStrengths: ['City'], considerations: [], dataCompleteness: 20 };
let tree: Renderer.ReactTestRenderer;
const props = { visible: true, onClose: jest.fn(), analysis: calculateGeminiHoroscopeMatch(a, b), myProfile: a, theirProfile: b };
beforeEach(() => { (getMatchCapabilities as jest.Mock).mockResolvedValue({ service: 'match-insights', version: 1, aiConfigured: true }); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.clearAllMocks(); });
const text = () => tree.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
test('never calls Gemini automatically and labels server fallback honestly', async () => {
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal {...props} />); });
  expect(getMatchInsights).not.toHaveBeenCalled();
  expect(text()).toContain('Conversation starters');
  (getMatchInsights as jest.Mock).mockResolvedValue(result);
  await act(async () => tree.root.findAllByType(AppButton).find(node => node.props.title === 'Request AI insights')!.props.onPress());
  expect(getMatchInsights).toHaveBeenCalledWith('b', true);
  expect(text()).toContain('AI is unavailable');
  expect(text()).not.toContain('Gemini AI insights');
});
test('candidate changes discard a late response for the previous match', async () => {
  let finish!: (value: unknown) => void;
  (getMatchInsights as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal {...props} />); });
  let pending!: Promise<void>;
  await act(async () => { pending = tree.root.findAllByType(AppButton)[0].props.onPress(); });
  await act(async () => { tree.update(<GeminiHoroscopeModal {...props} theirProfile={{ ...b, id: 'c' }} />); });
  await act(async () => { finish({ ...result, summary: 'STALE RESPONSE' }); await pending; });
  expect(text()).not.toContain('STALE RESPONSE');
});

test('an undeployed service does not offer an AI request that will fail', async () => {
  (getMatchCapabilities as jest.Mock).mockRejectedValueOnce({ status: 404 });
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal {...props} />); });
  expect(text()).toContain('AI insights are currently unavailable');
  expect(tree.root.findAllByType(AppButton).some(node => node.props.title === 'Request AI insights')).toBe(false);
  expect(getMatchInsights).not.toHaveBeenCalled();
  expect(text()).toContain('Conversation starters');
});
test('a missing key is an availability state and can be rechecked after server setup', async () => {
  (getMatchCapabilities as jest.Mock).mockResolvedValueOnce({ service: 'match-insights', version: 1, aiConfigured: false });
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal {...props} />); });
  expect(text()).toContain('not enabled right now');
  (getMatchCapabilities as jest.Mock).mockResolvedValueOnce({ service: 'match-insights', version: 1, aiConfigured: true });
  await act(async () => tree.root.findAllByType(AppButton).find(node => node.props.title === 'Check AI availability')!.props.onPress());
  expect(tree.root.findAllByType(AppButton).some(node => node.props.title === 'Request AI insights')).toBe(true);
});
test('service removal between availability check and request is handled without endless retries', async () => {
  (getMatchInsights as jest.Mock).mockRejectedValueOnce({ status: 404 });
  await act(async () => { tree = Renderer.create(<GeminiHoroscopeModal {...props} />); });
  await act(async () => tree.root.findAllByType(AppButton).find(node => node.props.title === 'Request AI insights')!.props.onPress());
  expect(text()).toContain('AI insights are currently unavailable');
  expect(tree.root.findAllByType(AppButton).some(node => node.props.title === 'Request AI insights')).toBe(false);
});
