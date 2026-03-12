import { useQueries } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import { invoicesKeys } from './useInvoicesQuery';
import type { CreditNoteRow } from '../api/billing';

/**
 * Fetch credit notes for multiple invoices using React Query.
 * Uses useQueries to fetch notes for all invoices in parallel.
 */
export function useCreditNotesByInvoice(invoiceIds: string[]) {
  const queries = useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: [...invoicesKeys.details(), invoiceId, 'credit-notes'],
      queryFn: () => billingApi.getCreditNotesByInvoice(invoiceId),
      staleTime: 1000 * 60 * 3, // 3 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      enabled: invoiceIds.length > 0,
    })),
  });

  const notesMap = queries.reduce<Record<string, CreditNoteRow[]>>((acc, result, index) => {
    const invoiceId = invoiceIds[index];
    if (invoiceId && result.data) {
      acc[invoiceId] = result.data;
    }
    return acc;
  }, {});

  return {
    data: notesMap,
    isLoading: queries.some((r) => r.isLoading),
    isFetching: queries.some((r) => r.isFetching),
    error: queries.find((r) => r.error)?.error || null,
  };
}

