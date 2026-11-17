"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";

// Contextual actions belong to one mounted chip, rather than every reference
// to an entity. Open previews subscribe so refreshed guards/callbacks stay current.
const actionsByChip = new Map<string, RecordMenuAction[]>();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useChipHoverActions(actions?: RecordMenuAction[]) {
  const key = useId();
  useEffect(() => {
    if (!actions?.length) return;
    actionsByChip.set(key, actions);
    notify();
    return () => { actionsByChip.delete(key); notify(); };
  }, [key, actions]);
  return actions?.length ? key : undefined;
}

export function useContextualChipHoverActions(key?: string) {
  return useSyncExternalStore(subscribe, () => key ? actionsByChip.get(key) : undefined, () => undefined);
}
