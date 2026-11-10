'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useReconciliationTabCounts } from '../api/queries';
import { operationalViews as views, operationalViewHref } from '@/features/quick-filters/config/operationalViews';

const STAT_ROWS = [
  { key: 'financial', label: 'Financial', views: [views.billingAdjustments, views.uninvoiced, views.voidInvoices, views.unpaid, views.noPayment] },
  { key: 'scheduling', label: 'Scheduling', views: [views.unlogged, views.noStaff, views.noClasses] },
  { key: 'operations', label: 'Operations', views: [views.unassignedTasks, views.noLead] },
] as const;

function CountBubble({
  value,
  isLoading,
  isError,
}: {
  value: number | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
        …
      </span>
    );
  }

  if (isError || value === undefined) {
    return (
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
        value > 0
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {value}
    </span>
  );
}

export function DashboardReconciliationCard() {
  const { data: counts, isLoading, isError } = useReconciliationTabCounts();

  const total =
    counts !== undefined
      ? counts.financial + counts.scheduling + counts.operations
      : undefined;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Reconciliation</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && !counts ? (
          <div className="flex items-center justify-center border-t py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y border-t">
            {STAT_ROWS.map(({ key, label, views }) => (
              <details key={key} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <ChevronDown aria-hidden className="h-4 w-4 -rotate-90 group-open:rotate-0" />
                  <span className="flex-1">{label}</span>
                  <CountBubble value={counts?.[key]} isLoading={isLoading} isError={isError} />
                </summary>
                <ul className="pb-2">
                  {views.map((view) => (
                    <li key={view.slug}>
                      <Link href={operationalViewHref(view)} className="flex items-center justify-between gap-2 py-2 pl-10 pr-4 text-sm hover:bg-muted/50">
                        {view.name}<ArrowRight aria-hidden className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <div className="flex items-center justify-between bg-muted/30 px-4 py-3 text-sm font-medium">
              <span>Total open items</span>
              <CountBubble value={total} isLoading={isLoading} isError={isError} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
