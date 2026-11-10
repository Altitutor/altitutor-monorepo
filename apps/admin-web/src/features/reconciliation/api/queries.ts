import { useQuery } from '@tanstack/react-query';
import { reconciliationApi, getReconciliationTabCounts } from './reconciliation';
import { reconciliationKeys } from './queryKeys';

/**
 * Get uninvoiced sessions
 */
export function useUninvoicedSessions() {
  return useQuery({
    queryKey: reconciliationKeys.uninvoicedSessions(),
    queryFn: () => reconciliationApi.getUninvoicedSessions(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSessionBillingAdjustmentIssues(enabled = true) {
  return useQuery({
    enabled,
    queryKey: reconciliationKeys.sessionBillingAdjustments(),
    queryFn: () => reconciliationApi.getSessionBillingAdjustmentIssues(),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Sessions billed only on void invoices (re-invoicing may be required)
 */
export function useVoidInvoiceSessions(enabled = true) {
  return useQuery({
    enabled,
    queryKey: reconciliationKeys.voidInvoiceSessions(),
    queryFn: () => reconciliationApi.getVoidInvoiceSessions(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Row counts per reconciliation tab (for navigation badges).
 */
export function useReconciliationTabCounts() {
  return useQuery({
    queryKey: reconciliationKeys.tabCounts(),
    queryFn: () => getReconciliationTabCounts(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}
