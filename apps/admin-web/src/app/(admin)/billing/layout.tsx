'use client';
import { usePathname, useRouter } from 'next/navigation';
import { SegmentedControl } from '@altitutor/ui';
import { useReconciliationCount } from '@/features/reconciliation/api/useReconciliationCounts';

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const charges = useReconciliationCount('uninvoiced');
  const adjustments = useReconciliationCount('billing-adjustments');
  return <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1 space-y-6 overflow-auto p-6">
    <SegmentedControl fullWidth value={pathname} onValueChange={(value) => router.push(value)} options={[
      { value: '/billing/invoices', label: 'Invoices' },
      { value: '/billing/to-invoice', label: 'To invoice', badge: charges.data || null },
      { value: '/billing/adjustments', label: 'Adjustments', badge: adjustments.data || null },
    ]} />
    {children}
  </div></div>;
}
