import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import { billingApi, type Invoice, type InvoiceWithItems } from '../api';

export function useBilling() {
  return useQuery({
    queryKey: ['student', 'billing'],
    queryFn: billingApi.getBilling,
  });
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['student', 'invoices'],
    queryFn: billingApi.getInvoices,
  });
}

export function useInvoicesWithItems() {
  return useQuery<InvoiceWithItems[]>({
    queryKey: ['student', 'invoices', 'with-items'],
    queryFn: billingApi.getInvoicesWithItems,
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

