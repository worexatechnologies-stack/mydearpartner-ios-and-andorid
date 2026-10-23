import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AppState } from 'react-native';
import { readResumeValue, writeResumeValue } from '../utils/resumeStorage';

/** Account-scoped text drafts. Never persist passwords, OTPs or temporary files. */
export function usePersistentDraft<T extends Record<string, string>>(
  key: string | null,
  initialValue: T,
) {
  const initial = useRef(initialValue);
  const [snapshot, setSnapshot] = useState({ key, value: initialValue, ready: false });
  const live = useRef(snapshot);
  const touched = useRef(new Set<string>());
  const suppressed = useRef(false);
  const value = snapshot.key === key ? snapshot.value : initialValue;

  useEffect(() => {
    let cancelled = false;
    initial.current = initialValue;
    touched.current = new Set();
    suppressed.current = false;
    live.current = { key, value: initial.current, ready: false };
    setSnapshot(live.current);
    const restore = async () => {
      const saved = key ? await readResumeValue<unknown>(key) : null;
      if (cancelled) return;
      const restored = { ...initial.current };
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const [field, text] of Object.entries(saved)) {
          if (typeof text === 'string' && text.length <= 20000 &&
              field !== '__proto__' && field !== 'constructor' && field !== 'prototype') {
            (restored as Record<string, string>)[field] = text;
          }
        }
      }
      // Typing during the storage read wins over the older stored draft.
      for (const field of touched.current) {
        if (field in live.current.value) (restored as Record<string, string>)[field] = live.current.value[field];
        else delete restored[field];
      }
      live.current = { key, value: restored, ready: true };
      setSnapshot(live.current);
      if (key && touched.current.size && !suppressed.current) {
        void writeResumeValue(key, restored);
      }
    };
    void restore();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && key && live.current.ready && !suppressed.current) {
        void writeResumeValue(key, live.current.value);
      }
    });
    return () => { cancelled = true; subscription.remove(); };
    // The initial value is captured once per draft identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback<Dispatch<SetStateAction<T>>>(action => {
    const previous = live.current.value;
    const next = typeof action === 'function' ? action(previous) : action;
    for (const field of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (previous[field] !== next[field]) touched.current.add(field);
    }
    suppressed.current = false;
    live.current = { ...live.current, value: next };
    setSnapshot(live.current);
    if (key && live.current.ready) void writeResumeValue(key, next);
  }, [key]);

  const clear = useCallback(async () => {
    suppressed.current = true;
    if (key) await writeResumeValue(key, null);
  }, [key]);

  return [value, update, clear, snapshot.key === key && snapshot.ready] as const;
}
