import type { ReconciliationViewKey } from '@/features/quick-filters/config/operationalViews';

export type ReconciliationCounts = Partial<Record<ReconciliationViewKey, number>>;

const countLabels: Record<ReconciliationViewKey, string> = {
  'uninvoiced': 'Student/session charges to invoice (includes previously voided charges)',
  'void-invoices': 'Student/session charges linked to voided invoices',
  'billing-adjustments': 'Individual billing adjustments needing attention',
  'unpaid': 'Unpaid invoices with an outstanding balance',
  'no-payment-method': 'Active students without a payment method',
  'unlogged': 'Distinct sessions without a tutor log',
  'no-staff': 'Active classes with upcoming sessions without staff',
  'no-classes': 'Students with subjects needing a current class',
  'unassigned': 'Unassigned open tasks',
  'no-lead': 'Incomplete projects without a lead',
};

/** Count work entries, not distinct people or sessions across different queues. */
export function reconciliationCountSummary(keys: readonly ReconciliationViewKey[], counts: ReconciliationCounts) {
  const count = keys.every((key) => counts[key] !== undefined)
    ? keys.reduce((total, key) => total + (counts[key] ?? 0), 0)
    : undefined;
  const breakdown = keys.map((key) => `${countLabels[key]}: ${counts[key] ?? 'unavailable'}`).join('\n');
  const tooltip = keys.length > 1
    ? `Reconciliation queue entries${count === undefined ? '' : `: ${count}`}\n${breakdown}\nA person or session can appear in more than one queue.`
    : breakdown;
  return { count, tooltip };
}

export const sidebarReconciliationQueues: Record<string, readonly ReconciliationViewKey[]> = {
  '/students': ['no-classes', 'no-payment-method'],
  '/classes': ['no-staff'],
  '/sessions': ['unlogged'],
  '/tasks': ['unassigned'],
  '/projects': ['no-lead'],
  '/billing': ['unpaid', 'uninvoiced', 'billing-adjustments'],
  '/billing/invoices': ['unpaid'],
  '/billing/to-invoice': ['uninvoiced'],
  '/billing/adjustments': ['billing-adjustments'],
};
