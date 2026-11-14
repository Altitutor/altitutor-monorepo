import { billingChargesQuery, loadBillingCharges, type BillingCharge } from '@/features/billing/api/workQueues';
import { reconciliationApi } from './reconciliation';
import type { SessionBillingAdjustmentIssue } from '../types';
import { useQueries, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { reconciliationViews, type ReconciliationViewKey } from '@/features/quick-filters/config/operationalViews';
import { reconciliationCountReaders } from './reconciliation';
import { reconciliationKeys } from './queryKeys';
import { reconciliationSessionIdsQuery } from './sessionQueues';

type CountData = number | string[] | BillingCharge[] | SessionBillingAdjustmentIssue[];

function reconciliationCountOptions(key: ReconciliationViewKey): UseQueryOptions<CountData, Error, number> {
  const select = (value: CountData) => typeof value === 'number' ? value : value.length;
  switch (key) {
    case 'billing-adjustments':
      return { queryKey: reconciliationKeys.sessionBillingAdjustments(), queryFn: reconciliationApi.getSessionBillingAdjustmentIssues, staleTime: 30_000, select };
    case 'void-invoices':
      return { queryKey: billingChargesQuery.queryKey, queryFn: loadBillingCharges, staleTime: 30_000, select: (value) => (value as BillingCharge[]).filter((row) => row.reason === 'voided').length };
    case 'uninvoiced':
      return { queryKey: billingChargesQuery.queryKey, queryFn: loadBillingCharges, staleTime: 30_000, select };
    case 'unlogged':
      // The table and badge share the same distinct session IDs and cache.
      return { ...reconciliationSessionIdsQuery([key]), select };
    default:
      return {
        queryKey: reconciliationKeys.viewCount(key),
        queryFn: reconciliationCountReaders[key],
        staleTime: 120_000,
        select,
      };
  }
}

export function useReconciliationCount(key: ReconciliationViewKey) {
  return useQuery<CountData, Error, number>(reconciliationCountOptions(key));
}

export function useReconciliationCounts() {
  const results = useQueries({
    queries: reconciliationViews.map(({ slug }) => reconciliationCountOptions(slug)),
  });
  return Object.fromEntries(reconciliationViews.map(({ slug }, index) => [
    slug, results[index].data,
  ])) as Record<ReconciliationViewKey, number | undefined>;
}
