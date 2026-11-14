import type { SessionBillingAdjustmentIssue } from '@/features/reconciliation/types';

export interface SessionBillingIssue {
  id: string;
  label: string;
  guidance: string;
  details?: string;
  invoiceId?: string;
}

export function describeBillingAdjustment(row: SessionBillingAdjustmentIssue): SessionBillingIssue {
  const operation = { credit_note: 'Credit note', session_charge: 'Session charge', restoration_charge: 'Restored session charge' }[row.kind];
  const states = {
    failed_adjustment: {
      label: 'Needs review',
      guidance: 'Automatic processing has stopped. Share the details with technical support to check the billing records before trying again.',
    },
    retryable_adjustment: {
      label: 'Retry scheduled',
      guidance: 'Queued for another automatic attempt. If this keeps returning, share the details with technical support.',
    },
    blocked_by_failed_dependency: {
      label: 'Blocked by an earlier billing problem',
      guidance: 'An earlier adjustment failed. Ask technical support to resolve that first; this adjustment cannot proceed yet.',
    },
    overdue_adjustment: row.status === 'processing' ? {
      label: 'Processing delayed',
      guidance: 'Processing has taken longer than expected. The next billing run can recover it. If it remains here, share the details with technical support.',
    } : {
      label: 'Waiting for billing',
      guidance: 'This adjustment is due but has not been picked up. If it remains after the next billing run, share the details with technical support.',
    },
  };
  const state = states[row.issue];
  return {
    id: row.adjustment_id,
    label: `${operation} · ${state.label}`,
    guidance: state.guidance,
    details: [`Adjustment ${row.adjustment_id}`, `Attempts: ${row.attempt_count}/${row.max_attempts}`, row.last_error].filter(Boolean).join('\n'),
  };
}
