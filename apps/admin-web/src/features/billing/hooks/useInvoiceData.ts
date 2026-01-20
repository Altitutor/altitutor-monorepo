import { useQuery } from '@tanstack/react-query';
import { billingApi, type InvoiceRow, type InvoiceItemRow } from '../api/billing';
import { invoicesKeys } from './useInvoicesQuery';

interface UseInvoiceDataProps {
  invoiceId: string | null;
  enabled?: boolean;
}

interface UseInvoiceDataReturn {
  invoice: (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null }) | null;
  invoiceItems: InvoiceItemRow[];
  isLoading: boolean;
}

/**
 * Hook for loading invoice data and invoice items
 */
export function useInvoiceData({
  invoiceId,
  enabled = true,
}: UseInvoiceDataProps): UseInvoiceDataReturn {
  // Fetch invoice using React Query
  const { data: invoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: invoicesKeys.detail(invoiceId || ''),
    queryFn: () => billingApi.getInvoiceById(invoiceId!),
    enabled: enabled && !!invoiceId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  // Fetch invoice items using React Query
  const { data: invoiceItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: [...invoicesKeys.details(), invoiceId || '', 'items'],
    queryFn: () => billingApi.getInvoiceItemsByInvoice(invoiceId!),
    enabled: enabled && !!invoiceId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  return {
    invoice: invoice || null,
    invoiceItems,
    isLoading: isLoadingInvoice || isLoadingItems,
  };
}
