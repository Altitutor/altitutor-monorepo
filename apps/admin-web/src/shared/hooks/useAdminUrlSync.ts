'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Subscribe the component to URL search-param changes (required for useDataTable URL sync in Next.js App Router).
 */
export function useAdminUrlSync(): ReturnType<typeof useSearchParams> {
  return useSearchParams();
}
