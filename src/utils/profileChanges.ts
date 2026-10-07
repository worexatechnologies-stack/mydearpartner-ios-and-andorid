import { Profile } from '../types/models';

/** Send only edits, while retaining explicit clears of previously saved values. */
export function getProfileChanges(
  original: Partial<Profile> | undefined,
  edited: Partial<Profile>,
): Partial<Profile> {
  return Object.fromEntries(
    Object.entries(edited).filter(([key, value]) => {
      if (value === undefined) return false;
      const previous = original?.[key as keyof Profile];
      if (Array.isArray(value)) {
        return JSON.stringify(value) !== JSON.stringify(previous ?? []);
      }
      if (typeof value === 'string') {
        return value !== (typeof previous === 'string' ? previous.trim() : previous ?? '');
      }
      return value !== previous;
    }),
  );
}
