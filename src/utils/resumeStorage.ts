import { getItem, removeItem, setItem } from './storage';

// Serialize writes across screen unmounts so an older save cannot resurrect a
// cleared draft or overwrite a more recent navigation snapshot.
const writes = new Map<string, Promise<void>>();

export function writeResumeValue(key: string, value: unknown): Promise<void> {
  const next = (writes.get(key) ?? Promise.resolve()).then(() =>
    value === null ? removeItem(key) : setItem(key, value),
  );
  writes.set(key, next);
  void next.finally(() => {
    if (writes.get(key) === next) writes.delete(key);
  });
  return next;
}

export async function readResumeValue<T>(key: string): Promise<T | null> {
  await writes.get(key);
  return getItem<T>(key);
}
