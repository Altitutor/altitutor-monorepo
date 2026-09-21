/** Serializes local writes independently of the network, keeping the newest
 * unsent snapshot recoverable even when older requests finish later. */
export function createDraftWriter(storage: {
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
}) {
  let revision = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return {
    write(value: string) {
      const version = ++revision;
      const saved = tail
        .catch(() => undefined)
        .then(() => storage.write(value));
      tail = saved;
      return { version, saved };
    },
    acknowledge(version: number) {
      const cleared = tail
        .catch(() => undefined)
        .then(() => {
          if (revision === version) return storage.remove();
        });
      tail = cleared;
      return cleared;
    },
  };
}
