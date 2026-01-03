import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import { billingApi, type Invoice, type InvoiceWithItems } from '../api';

export function useBilling() {
  return useQuery({
    queryKey: ['student', 'billing'],
    queryFn: billingApi.getBilling,
  });
}

export function useInvoices(params?: { from?: string; to?: string }) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  const from = params?.from;
  const to = params?.to;
  const queryKey = ['student', 'invoices', from, to];
  
  return useQuery<Invoice[]>({
    queryKey: queryKey,
    queryFn: () => billingApi.getInvoices(params),
  });
}

export function useInvoicesWithItems(params?: { from?: string; to?: string }) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  const from = params?.from;
  const to = params?.to;
  const queryKey = ['student', 'invoices', 'with-items', from, to];
  
  return useQuery<InvoiceWithItems[]>({
    queryKey: queryKey,
    queryFn: () => billingApi.getInvoicesWithItems(params),
  });
}

export function useInvoiceItems(invoiceId: string) {
  return useQuery<Database['public']['Views']['vstudent_invoice_items']['Row'][]>({
    queryKey: ['student', 'invoice-items', invoiceId],
    queryFn: () => billingApi.getInvoiceItems(invoiceId),
    enabled: !!invoiceId,
  });
}

// Backward compatibility - use invoices instead of payment attempts
export function usePayments() {
  return useInvoices();
}

