/** Serialize persistence without dropping rapid edits or rolling back newer input. */
export function createPreferenceQueue<T extends object>(
  initial: T,
  persist: (change: Partial<T>, next: T) => Promise<unknown>,
  publish: (value: T) => void,
) {
  let confirmed = initial;
  let optimistic = initial;
  let tail = Promise.resolve();
  const revisions = new Map<keyof T, number>();
  return {
    reset(value: T) {
      confirmed = value;
      optimistic = value;
      publish(value);
    },
    update<K extends keyof T>(key: K, value: T[K]): Promise<void> {
      const revision = (revisions.get(key) ?? 0) + 1;
      revisions.set(key, revision);
      optimistic = { ...optimistic, [key]: value };
      publish(optimistic);
      const operation = tail.then(async () => {
        const next = { ...confirmed, [key]: value };
        try {
          const change: Partial<T> = {};
          change[key] = value;
          await persist(change, next);
          confirmed = next;
        } catch (error) {
          if (revisions.get(key) === revision) {
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
