import { useQueries, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { reconciliationViews, type ReconciliationViewKey } from '@/features/quick-filters/config/operationalViews';
import { reconciliationCountReaders } from './reconciliation';
import { reconciliationKeys } from './queryKeys';
import { reconciliationSessionIdsQuery } from './sessionQueues';

function reconciliationCountOptions(key: ReconciliationViewKey): UseQueryOptions<number | string[], Error, number> {
  const select = (value: number | string[]) => typeof value === 'number' ? value : value.length;
  switch (key) {
    case 'billing-adjustments':
    case 'uninvoiced':
    case 'void-invoices':
    case 'unlogged':
      // The table and badge share the same distinct session IDs and cache.
      return { ...reconciliationSessionIdsQuery([key]), select };
    default:
      return {
        queryKey: [...reconciliationKeys.tabCounts(), key],
        queryFn: reconciliationCountReaders[key],
        staleTime: 120_000,
        select,
      };
  }
}

export function useReconciliationCount(key: ReconciliationViewKey) {
  return useQuery<number | string[], Error, number>(reconciliationCountOptions(key));
}

export function useReconciliationCounts() {
  const results = useQueries({
    queries: reconciliationViews.map(({ slug }) => reconciliationCountOptions(slug)),
  });
  return Object.fromEntries(reconciliationViews.map(({ slug }, index) => [
    slug, results[index].data,
  ])) as Record<ReconciliationViewKey, number | undefined>;
}
