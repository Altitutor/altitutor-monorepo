'use client';

import { useMyBillingSubsidies } from '../hooks/useMyBillingSubsidies';
import { Skeleton } from '@altitutor/ui';
import { studentCardCn } from '@/shared/lib/student-visual';

function formatHourlyPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BillingSubsidiesSection() {
  const { data: rows, isFetched, isError } = useMyBillingSubsidies();

  if (!isFetched) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My subsidies</h2>
        <div className={studentCardCn('space-y-3 p-4')} aria-label="Loading subsidies">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My subsidies</h2>
        <div className={studentCardCn('p-5 text-sm text-destructive')}>
          Failed to load subsidy information.
        </div>
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My subsidies</h2>
        <div className={studentCardCn('p-5 text-sm text-muted-foreground')}>
          No billing subsidies are currently applied to your account.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold">My subsidies</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={`${row.subject_id}-${row.billing_type}`} className={studentCardCn('px-4 py-3.5')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium leading-tight">{row.subject_long_name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end shrink-0">
                <span className="font-medium tabular-nums">
                  {formatHourlyPrice(row.subsidy_hourly_cents, row.currency)}
                  <span className="text-muted-foreground font-normal"> / hr</span>
                </span>
                <span
                  className="tabular-nums line-through text-muted-foreground opacity-60"
                  aria-label={`Standard rate ${formatHourlyPrice(row.standard_hourly_cents, row.currency)} per hour`}
                >
                  {formatHourlyPrice(row.standard_hourly_cents, row.currency)}
                  <span className="font-normal"> / hr</span>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
