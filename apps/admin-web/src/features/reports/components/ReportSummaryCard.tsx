import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';

export interface ReportSummaryEntry {
  label: string;
  value: number | string;
}

interface ReportSummaryCardProps {
  total: number | string;
  totalLabel?: string;
  entries?: ReportSummaryEntry[];
  entriesLabel?: string;
}

export function ReportSummaryCard({
  total,
  totalLabel = 'Total',
  entries = [],
  entriesLabel = 'By staff member',
}: ReportSummaryCardProps) {
  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{totalLabel}</CardTitle>
        <p className="text-3xl font-semibold tabular-nums">{total}</p>
      </CardHeader>
      {entries.length > 0 && (
        <CardContent className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {entriesLabel}
          </p>
          <dl className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.label} className="flex items-start justify-between gap-3 text-sm">
                <dt className="min-w-0 truncate text-muted-foreground" title={entry.label}>
                  {entry.label}
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

