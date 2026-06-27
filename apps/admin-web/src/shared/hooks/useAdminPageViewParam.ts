'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAdminUrlSync } from './useAdminUrlSync';

/**
 * URL-backed segmented view toggle (e.g. kanban vs list, table vs calendar).
 * Preserves other query params (filters, sort, etc.) on the same page.
 */
export function useAdminPageViewParam<T extends string>(
  validViews: readonly T[],
  defaultView: T,
): [T, (view: T) => void] {
  useAdminUrlSync();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = searchParams.get('view');
  const view = validViews.includes(raw as T) ? (raw as T) : defaultView;

  const setView = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', next);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [view, setView];
}
