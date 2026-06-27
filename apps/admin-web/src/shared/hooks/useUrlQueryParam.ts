'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAdminUrlSync } from './useAdminUrlSync';

/**
 * Read/write a single URL query param while preserving other params on the page.
 */
export function useUrlQueryParam(name: string, defaultValue = ''): [string, (value: string) => void] {
  useAdminUrlSync();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const readValue = useCallback(
    () => searchParams.get(name) ?? defaultValue,
    [searchParams, name, defaultValue],
  );

  const [value, setValueState] = useState(readValue);

  useEffect(() => {
    setValueState(readValue());
  }, [readValue]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next && next !== defaultValue) {
        params.set(name, next);
      } else {
        params.delete(name);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [defaultValue, name, pathname, router, searchParams],
  );

  return [value, setValue];
}
