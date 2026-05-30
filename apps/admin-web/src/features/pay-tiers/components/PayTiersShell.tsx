'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';
import { usePayTiersStaffSummaries, usePayTiers } from '../hooks';

const NAV = [
  { segment: 'progression', href: '/pay-tiers', label: 'Staff progression', exact: true },
  { segment: 'ladder', href: '/pay-tiers/ladder', label: 'Tier ladder', exact: false },
] as const;

export function PayTiersShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        <p className="text-muted-foreground mt-1">
          Staff progression, check-ins, promotion reviews, and tier ladder configuration.
        </p>
      </div>

      <nav
        className="grid w-full max-w-md grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
        aria-label="Pay tiers sections"
      >
        {NAV.map(({ segment, href, label, exact }) => {
          const active = exact ? pathname === href : pathname?.startsWith(href);
          const badge = formatBadge(segment);
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:bg-background/60 hover:text-foreground'
              )}
            >
              <span>{label}</span>
              {badge !== null ? (
                <span
                  className={cn(
                    'tabular-nums rounded-md bg-muted-foreground/15 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground',
                    active && 'bg-primary/10 text-primary'
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
