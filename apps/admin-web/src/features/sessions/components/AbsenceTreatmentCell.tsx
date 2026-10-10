'use client';

import type { AbsenceBillingTreatment } from '../constants/attendanceStatuses';
import { cn } from '@/shared/utils';

type AbsenceTreatmentCellProps = {
  treatment: AbsenceBillingTreatment | null;
  recordedDate?: string;
  replacementSessionId?: string;
  replacementSessionLabel?: string;
  onOpenSession?: (id: string) => void;
};

const treatments = {
  charge: {
    label: 'Charge',
    style:
      'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    description: 'The original session remains chargeable.',
  },
  credit: {
    label: 'Credit',
    style: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    description:
      'Credit treatment selected. See Invoice for the financial outcome.',
  },
  replacement: {
    label: 'Replacement',
    style:
      'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    description: 'Replacement treatment selected for the original session.',
  },
} as const;

/** Show selected absence treatment independently of attendance and invoice status. */
export function AbsenceTreatmentCell({
  treatment,
  recordedDate,
  replacementSessionId,
  replacementSessionLabel,
  onOpenSession,
}: AbsenceTreatmentCellProps) {
  if (!treatment)
    return <span className="text-muted-foreground text-sm">—</span>;
  const config = treatments[treatment];
  const label = `${config.label}${treatment === 'replacement' && replacementSessionLabel ? `: ${replacementSessionLabel}` : ''}`;
  const content = (
    <span
      className={cn('inline-block rounded-md px-2 py-1 text-sm', config.style)}
      title={`${config.description} Actual attendance can change chargeability.${recordedDate ? ` Selected ${recordedDate}.` : ''}`}
    >
      {label}
    </span>
  );
  if (treatment === 'replacement' && replacementSessionId && onOpenSession) {
    return (
      <button
        type="button"
        className="text-left hover:opacity-80"
        onClick={(event) => {
          event.stopPropagation();
          onOpenSession(replacementSessionId);
        }}
      >
        {content}
      </button>
    );
  }
  return content;
}
