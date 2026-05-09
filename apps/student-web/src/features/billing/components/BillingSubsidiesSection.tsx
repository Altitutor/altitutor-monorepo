'use client';

import { useMyBillingSubsidies } from '../hooks/useMyBillingSubsidies';

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
  const { data: rows, isFetched } = useMyBillingSubsidies();

  if (!isFetched || !rows?.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My subsidies</h2>
      <ul className="rounded-lg border divide-y">
        {rows.map((row) => (
          <li key={`${row.subject_id}-${row.billing_type}`} className="px-4 py-3">
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
