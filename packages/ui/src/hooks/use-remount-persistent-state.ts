'use client';

import * as React from 'react';

interface PersistentEntry<T> {
  value: T;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const entries = new Map<string, PersistentEntry<unknown>>();

/** Preserve transient UI state across a brief remount in the same React tree. */
export function useRemountPersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = React.useState<T>(() => {
    const existing = entries.get(key) as PersistentEntry<T> | undefined;
    return existing?.value ?? initialValue;
  });

  React.useLayoutEffect(() => {
    const existing = entries.get(key) as PersistentEntry<T> | undefined;
    if (existing?.cleanupTimer) clearTimeout(existing.cleanupTimer);
    entries.set(key, { value });

    return () => {
      const entry = entries.get(key) as PersistentEntry<T> | undefined;
      if (!entry) return;
      entry.cleanupTimer = setTimeout(() => entries.delete(key), 1_000);
    };
  }, [key, value]);

  const setPersistentValue = React.useCallback(
    (nextValue: React.SetStateAction<T>) => {
      setValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === 'function'
            ? (nextValue as (current: T) => T)(currentValue)
            : nextValue;
        entries.set(key, { value: resolvedValue });
        return resolvedValue;
      });
    },
    [key]
  );

  return [value, setPersistentValue] as const;
}
