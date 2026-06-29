'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SegmentedControl } from '@altitutor/ui';
import { usePayTiersStaffSummaries, usePayTiers } from '../hooks';

const NAV = [
  { segment: 'progression', href: '/pay-tiers', label: 'Staff progression', exact: true },
  { segment: 'ladder', href: '/pay-tiers/ladder', label: 'Tier ladder', exact: false },
] as const;

export function PayTiersShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const staffSummaries = usePayTiersStaffSummaries();
  const tiers = usePayTiers();

  const formatBadge = (segment: (typeof NAV)[number]['segment']): string | null => {
    if (segment === 'progression') {
      if (staffSummaries.isPending) return '…';
      if (staffSummaries.isError) return '—';
      return String(staffSummaries.data?.length ?? 0);
    }
    if (tiers.isPending) return '…';
    if (tiers.isError) return '—';
    return String(tiers.data?.length ?? 0);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pay tiers</h1>
      </div>

      <SegmentedControl
        className="w-full max-w-md min-w-0"
        fullWidth
        aria-label="Pay tiers sections"
        value={
          NAV.find(({ href, exact }) => (exact ? pathname === href : pathname?.startsWith(href)))?.segment ??
          NAV[0].segment
        }
        onValueChange={(segment) => {
          const item = NAV.find((navItem) => navItem.segment === segment);
          if (item) router.push(item.href);
        }}
        options={NAV.map(({ segment, label }) => {
          const badge = formatBadge(segment);
          return {
            value: segment,
            label: badge === null ? label : `${label} (${badge})`,
          };
        })}
      />

      {children}
    </div>
  );
}
