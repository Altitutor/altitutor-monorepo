'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { RedCountBadge } from '@/shared/components/RedCountBadge';
import { useReconciliationCounts } from '../api/useReconciliationCounts';
import { reconciliationViewGroups, operationalViewHref } from '@/features/quick-filters/config/operationalViews';

function Count({ value }: { value: number | undefined }) {
  return value === undefined
    ? <span aria-label="Count unavailable" className="px-1.5 text-xs text-muted-foreground">—</span>
    : <RedCountBadge count={value} />;
}

function totalCount(values: (number | undefined)[]) {
  return values.every((value): value is number => value !== undefined)
    ? values.reduce((total, count) => total + count, 0) : undefined;
}

export function DashboardReconciliationCard() {
  const counts = useReconciliationCounts();
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Reconciliation</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y border-t">
          {reconciliationViewGroups.map(({ key, label, views }) => (
            <details key={key} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 -rotate-90 group-open:rotate-0" />
                <span className="flex-1">{label}</span>
                <Count value={totalCount(views.map(({ slug }) => counts[slug]))} />
              </summary>
              <ul className="pb-2">
                {views.map((view) => (
                  <li key={view.slug}>
                    <Link href={operationalViewHref(view)} className="flex items-center gap-2 py-2 pl-9 pr-4 text-sm hover:bg-muted/50">
                      <span className="flex-1">{view.name}</span>
                      <Count value={counts[view.slug]} />
                      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <div className="flex items-center justify-between bg-muted/30 px-4 py-3 text-sm font-medium">
            <span>Total open items</span>
            <Count value={totalCount(Object.values(counts))} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
