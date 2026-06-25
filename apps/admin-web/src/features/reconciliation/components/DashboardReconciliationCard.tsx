'use client';

import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useReconciliationTabCounts } from '../api/queries';

const STAT_ROWS = [
  { key: 'financial' as const, label: 'Financial', href: '/reconciliation/financial' },
  { key: 'scheduling' as const, label: 'Scheduling', href: '/reconciliation/scheduling' },
  { key: 'communication' as const, label: 'Communication', href: '/reconciliation/communication' },
  { key: 'operations' as const, label: 'Operations', href: '/reconciliation/operations' },
];

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
      ? counts.financial + counts.scheduling + counts.communication + counts.operations
      : undefined;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Reconciliation</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/reconciliation" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Reconciliation
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && !counts ? (
          <div className="flex items-center justify-center border-t py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y border-t">
            {STAT_ROWS.map(({ key, label, href }) => (
              <Link
                key={key}
                href={href}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50"
              >
                <span>{label}</span>
                <CountBubble value={counts?.[key]} isLoading={isLoading} isError={isError} />
              </Link>
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
