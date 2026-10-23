import type { InitialState } from '@react-navigation/native';
import { accountStorageKey } from '../utils/storage';
import { readResumeValue, writeResumeValue } from '../utils/resumeStorage';

const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const tabs = new Set(['Discover', 'Search', 'Interests', 'Chats', 'MyProfile']);
const simpleScreens = new Set([
  'EditProfile', 'Membership', 'Visitors', 'Verification', 'Settings', 'Blocked', 'Notifications',
]);
type ResumeRoute = { name: string; params?: Record<string, string>; state?: InitialState };
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

/** Rebuild only supported routes and ID parameters; discard stale router keys. */
export function sanitizeResumeState(value: unknown): InitialState | undefined {
  if (!record(value) || !Array.isArray(value.routes) || value.routes.length > 30 ||
      !Number.isInteger(value.index) || value.index < 0 || value.index >= value.routes.length) return;
  const routes: ResumeRoute[] = [];
  for (const route of value.routes.slice(0, value.index + 1)) {
    if (!record(route)) continue;
    const params = record(route.params) ? route.params : {};
    if (route.name === 'Main') {
      const nested = record(route.state) ? route.state : null;
      const selected = nested && Array.isArray(nested.routes)
        ? nested.routes[nested.index ?? 0]?.name : params.screen;
      routes.push({ name: 'Main', state: {
        index: 0, routes: [{ name: tabs.has(selected) ? selected : 'Discover' }],
      } });
    } else if (simpleScreens.has(route.name)) {
      routes.push({ name: route.name });
    } else if (route.name === 'ProfileDetail' && id(params.profileId)) {
      routes.push({ name: route.name, params: { profileId: params.profileId } });
    } else if (route.name === 'Chat' && id(params.chatId) && id(params.otherProfileId)) {
      routes.push({ name: route.name, params: { chatId: params.chatId, otherProfileId: params.otherProfileId } });
    } else if (route.name === 'Compare') {
      routes.push({ name: route.name, params: Object.fromEntries(
        ['profileId1', 'profileId2'].filter(key => id(params[key])).map(key => [key, params[key]]),
      ) });
    }
  }
  if (!routes.length) return;
  if (routes[0].name !== 'Main') routes.unshift({ name: 'Main' });
  return { index: routes.length - 1, routes };
}

export function saveResumeState(accountId: string, state: unknown) {
  const sanitized = sanitizeResumeState(state);
  if (!sanitized) return Promise.resolve();
  return writeResumeValue(accountStorageKey('@mdp/navigation-v1', accountId), {
    version: 1, savedAt: Date.now(), state: sanitized,
  });
}

export async function loadResumeState(accountId: string) {
  const saved = await readResumeValue<unknown>(accountStorageKey('@mdp/navigation-v1', accountId));
  if (!record(saved) || saved.version !== 1 || typeof saved.savedAt !== 'number' ||
      Date.now() - saved.savedAt > MAX_AGE || saved.savedAt > Date.now()) return;
  return sanitizeResumeState(saved.state);
}
