import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import type { InvoiceRow } from '../api/billing';

// Query Keys
export const invoicesKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoicesKeys.all, 'list'] as const,
  list: (filters: string) => [...invoicesKeys.lists(), { filters }] as const,
  details: () => [...invoicesKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoicesKeys.details(), id] as const,
};

// Paginated server-filtered invoices list
export interface UseInvoicesListParams {
  statuses?: InvoiceRow['status'][];
  studentIds?: string[];
  from?: string;
  to?: string;
  page?: number; // 1-based
  pageSize?: number;
  orderBy?: 'invoice_date' | 'created_at' | 'status' | 'amount_due_cents';
  ascending?: boolean;
}

export function useInvoicesList(params: UseInvoicesListParams) {
  const {
    statuses = [],
    studentIds = [],
    from,
    to,
    page = 1,
    pageSize = 50,
    orderBy = 'invoice_date',
    ascending = false,
  } = params || {};

  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: [
      ...invoicesKeys.lists(),
      [...statuses].sort().join(','),
      [...studentIds].sort().join(','),
      from || null,
      to || null,
      page,
      pageSize,
      orderBy,
      ascending,
    ],
    queryFn: () =>
      billingApi.listInvoices({
        statuses: statuses.length > 0 ? statuses : undefined,
        studentIds: studentIds.length > 0 ? studentIds : undefined,
        from,
        to,
        limit: pageSize,
        offset,
        orderBy,
        ascending,
      }),
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

