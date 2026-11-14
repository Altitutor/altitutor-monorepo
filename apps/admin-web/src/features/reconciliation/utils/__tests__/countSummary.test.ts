import { reconciliationCountSummary, sidebarReconciliationQueues } from '../countSummary';

test('invoice navigation totals unpaid invoices, charges and adjustments once', () => {
  const result = reconciliationCountSummary(sidebarReconciliationQueues['/billing'], {
    unpaid: 2, uninvoiced: 5, 'void-invoices': 3, 'billing-adjustments': 6,
  });
  // Previously voided charges are already included in To invoice.
  expect(result.count).toBe(13);
  expect(result.tooltip).toContain('Unpaid invoices with an outstanding balance: 2');
  expect(result.tooltip).toContain('Student/session charges to invoice (includes previously voided charges): 5');
  expect(result.tooltip).toContain('Individual billing adjustments needing attention: 6');
  expect(result.tooltip).toContain('Not yet invoiced: 2');
  expect(result.tooltip).toContain('Previously voided: 3');
});

test('student totals describe queue entries rather than unique students', () => {
  const result = reconciliationCountSummary(sidebarReconciliationQueues['/students'], {
    'no-classes': 3, 'no-payment-method': 2,
  });
  expect(result.count).toBe(5);
  expect(result.tooltip).toContain('Students with subjects needing a current class: 3');
  expect(result.tooltip).toContain('Active students without a payment method: 2');
  expect(result.tooltip).toContain('can appear in more than one queue');
});

test('an unavailable constituent does not produce a misleading partial total', () => {
  const result = reconciliationCountSummary(['unlogged', 'no-staff'], { unlogged: 4 });
  expect(result.count).toBeUndefined();
  expect(result.tooltip).toContain('Active classes with upcoming sessions without staff: unavailable');
});

test('empty queues retain zero so the badge can hide it', () => {
  expect(reconciliationCountSummary(['unassigned', 'no-lead'], { unassigned: 0, 'no-lead': 0 }).count).toBe(0);
});
