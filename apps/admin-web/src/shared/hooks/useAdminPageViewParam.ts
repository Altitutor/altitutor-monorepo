'use client';

import { useCallback } from 'react';
import { usePaneNavigation } from './usePaneNavigation';
import { useAdminUrlSync } from './useAdminUrlSync';

/**
 * URL-backed segmented view toggle (e.g. kanban vs list, table vs calendar).
 * Preserves other query params (filters, sort, etc.) on the same page.
 */
export function useAdminPageViewParam<T extends string>(
  validViews: readonly T[],
  defaultView: T,
  paramName = 'view',
): [T, (view: T) => void] {
  useAdminUrlSync();
  const { router, searchParams, pathname } = usePaneNavigation();

  const raw = searchParams.get(paramName);
  const resolved = paramName === 'tab' && raw === 'messages' ? 'activity' : raw;
  const view = validViews.includes(resolved as T) ? (resolved as T) : defaultView;

  const setView = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, next);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, paramName],
  );

  return [view, setView];
}
