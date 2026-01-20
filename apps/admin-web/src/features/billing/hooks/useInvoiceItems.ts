import { useQueries } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import { invoicesKeys } from './useInvoicesQuery';
import type { InvoiceItemRow } from '../api/billing';

/**
 * Fetch invoice items for multiple invoices using React Query
 * Uses useQueries to fetch items for all invoices in parallel
 */
export function useInvoiceItems(invoiceIds: string[]) {
  const queries = useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: [...invoicesKeys.details(), invoiceId, 'items'],
      queryFn: () => billingApi.getInvoiceItemsByInvoice(invoiceId),
      staleTime: 1000 * 60 * 3, // 3 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      enabled: invoiceIds.length > 0,
    })),
  });

  // Combine results into a map
  const itemsMap = queries.reduce<Record<string, InvoiceItemRow[]>>((acc, result, index) => {
    const invoiceId = invoiceIds[index];
    if (invoiceId && result.data) {
      acc[invoiceId] = result.data;
    }
    return acc;
  }, {});

  return {
    data: itemsMap,
    isLoading: queries.some((r) => r.isLoading),
    isFetching: queries.some((r) => r.isFetching),
    error: queries.find((r) => r.error)?.error || null,
  };
}
