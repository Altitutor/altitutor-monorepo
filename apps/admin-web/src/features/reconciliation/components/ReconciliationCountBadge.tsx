'use client';

import type { ReconciliationViewKey } from '@/features/quick-filters/config/operationalViews';
import { RedCountBadge } from '@/shared/components/RedCountBadge';
import { reconciliationCountSummary, type ReconciliationCounts } from '../utils/countSummary';

export function ReconciliationCountBadge({ queues, counts, className }: {
  queues: readonly ReconciliationViewKey[];
  counts: ReconciliationCounts;
  className?: string;
}) {
  const { count, tooltip } = reconciliationCountSummary(queues, counts);
  if (count === undefined) return <span aria-label="Count unavailable" className="px-1.5 text-xs text-muted-foreground">—</span>;
  return <RedCountBadge count={count} tooltip={tooltip} className={className} />;
}
