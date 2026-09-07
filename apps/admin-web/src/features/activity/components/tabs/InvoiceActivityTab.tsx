'use client';

import { ActivityTabLayout } from '../ActivityTabLayout';
import { useInvoiceActivity } from '../../hooks';

interface InvoiceActivityTabProps {
  invoiceId: string;
  isOpen?: boolean;
}

export function InvoiceActivityTab({ invoiceId, isOpen = true }: InvoiceActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInvoiceActivity(invoiceId, isOpen);

  return (
    <ActivityTabLayout
      chronological
      data={data}
      isLoading={isLoading}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
    />
  );
}
