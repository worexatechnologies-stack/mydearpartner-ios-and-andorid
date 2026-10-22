/** Serialize persistence without dropping rapid edits or rolling back newer input. */
export function createPreferenceQueue<T extends object>(
  initial: T,
  persist: (change: Partial<T>, next: T) => Promise<unknown>,
  publish: (value: T) => void,
) {
  let confirmed = initial;
  let optimistic = initial;
  let tail = Promise.resolve();
  let generation = 0;
  const revisions = new Map<keyof T, number>();
  return {
    reset(value: T) {
      generation++;
      revisions.clear();
      tail = Promise.resolve();
      confirmed = value;
      optimistic = value;
      publish(value);
    },
    update<K extends keyof T>(key: K, value: T[K]): Promise<void> {
      const startedGeneration = generation;
      const revision = (revisions.get(key) ?? 0) + 1;
      revisions.set(key, revision);
      optimistic = { ...optimistic, [key]: value };
      publish(optimistic);
      const operation = tail.then(async () => {
        if (startedGeneration !== generation) {
          throw new Error('Account settings changed. Please try again.');
        }
        const next = { ...confirmed, [key]: value };
        try {
          const change: Partial<T> = {};
          change[key] = value;
          await persist(change, next);
          if (startedGeneration !== generation) return;
          confirmed = next;
        } catch (error) {
          if (startedGeneration === generation && revisions.get(key) === revision) {
            optimistic = { ...optimistic, [key]: confirmed[key] };
            publish(optimistic);
          }
          throw error;
        }
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}
