"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

function createWidthStore(initialWidth: number | null) {
  let width = initialWidth;
  const listeners = new Set<() => void>();
  return {
    getWidth: () => width,
    setWidth(next: number | null) {
      if (next === width) return;
      width = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const MediaQueryWidthContext = createContext<ReturnType<
  typeof createWidthStore
> | null>(null);

/** A stable store lets each consumer subscribe to its query result, rather than every pixel. */
export function MediaQueryWidthProvider({
  width,
  children,
}: {
  width: number | null;
  children: ReactNode;
}) {
  const [store] = useState(() => createWidthStore(width));
  useLayoutEffect(() => store.setWidth(width), [store, width]);
  return createElement(
    MediaQueryWidthContext.Provider,
    { value: store },
    children,
  );
}

const serverSnapshot = () => false;
/** Disabled queries return false and do not subscribe to width changes. */
export function useMediaQuery(query: string, enabled = true) {
  const store = useContext(MediaQueryWidthContext);
  const media = useMemo(
    () =>
      !enabled || typeof window === "undefined"
        ? null
        : window.matchMedia(query),
    [query, enabled],
  );
  const bounds = useMemo(
    () => ({
      min: query.match(/min-width:\s*([\d.]+)px/),
      max: query.match(/max-width:\s*([\d.]+)px/),
    }),
    [query],
  );
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) return () => {};
      const unsubscribe = store?.subscribe(listener);
      media?.addEventListener("change", listener);
      return () => {
        unsubscribe?.();
        media?.removeEventListener("change", listener);
      };
    },
    [store, media, enabled],
  );
  const snapshot = useCallback(() => {
    if (!enabled) return false;
    const width = store?.getWidth() ?? null;
    if (width !== null && (bounds.min || bounds.max)) {
      return (
        (!bounds.min || width >= Number(bounds.min[1])) &&
        (!bounds.max || width <= Number(bounds.max[1]))
      );
    }
    return media?.matches ?? false;
  }, [store, bounds, media, enabled]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
