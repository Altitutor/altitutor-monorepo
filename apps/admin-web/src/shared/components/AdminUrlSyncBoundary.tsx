'use client';

import { Suspense, type ReactNode } from 'react';

/**
 * Wraps admin list pages so useSearchParams / useDataTable URL sync works reliably.
 */
export function AdminUrlSyncBoundary({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
