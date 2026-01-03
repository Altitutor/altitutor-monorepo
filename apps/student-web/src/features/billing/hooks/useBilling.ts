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
  return useQuery<Invoice[]>({
    queryKey: ['student', 'invoices', params],
    queryFn: () => billingApi.getInvoices(params),
  });
}

export function useInvoicesWithItems(params?: { from?: string; to?: string }) {
  return useQuery<InvoiceWithItems[]>({
    queryKey: ['student', 'invoices', 'with-items', params],
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

