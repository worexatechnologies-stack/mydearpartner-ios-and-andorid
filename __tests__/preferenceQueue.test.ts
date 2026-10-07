import { createPreferenceQueue } from '../src/utils/preferenceQueue';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('rapid changes appear immediately and all persist in order', async () => {
  const first = deferred();
  const persist = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const publish = jest.fn();
  const queue = createPreferenceQueue({ push: true, email: true }, persist, publish);
  const a = queue.update('push', false);
  const b = queue.update('email', false);
  expect(publish).toHaveBeenLastCalledWith({ push: false, email: false });
  await Promise.resolve();
  expect(persist).toHaveBeenCalledTimes(1);
  first.resolve();
  await Promise.all([a, b]);
  expect(persist.mock.calls).toEqual([
    [{ push: false }, { push: false, email: true }],
    [{ email: false }, { push: false, email: false }],
  ]);
});

test('failed save rolls back only its field and later saves continue', async () => {
  const persist = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const publish = jest.fn();
  const queue = createPreferenceQueue({ push: true, email: true }, persist, publish);
  const a = queue.update('push', false);
  const b = queue.update('email', false);
  await expect(a).rejects.toThrow('offline');
  await b;
  expect(publish).toHaveBeenLastCalledWith({ push: true, email: false });
  expect(persist).toHaveBeenLastCalledWith({ email: false }, { push: true, email: false });
});

test('an older failure cannot undo a newer toggle of the same setting', async () => {
  const persist = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const publish = jest.fn();
  const queue = createPreferenceQueue({ push: true }, persist, publish);
  const a = queue.update('push', false);
  const b = queue.update('push', true);
  await expect(a).rejects.toThrow('offline');
  await b;
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenLastCalledWith({ push: true });
});
