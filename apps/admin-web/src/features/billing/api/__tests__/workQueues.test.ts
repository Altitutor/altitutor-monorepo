import { combineBillingCharges } from '../workQueues';
import type { UninvoicedSession, VoidInvoiceSession } from '@/features/reconciliation/types';

function charge(id: string, student: string): UninvoicedSession {
  return { sessions_students_id: id, session_id: 'shared-session', student_id: student } as UninvoicedSession;
}

describe('billing charge identity', () => {
  it('keeps each student assignment when several students share one session', () => {
    const rows = combineBillingCharges([charge('alice-charge', 'alice'), charge('bob-charge', 'bob')], []);
    expect(rows.map((row) => row.sessions_students_id)).toEqual(['alice-charge', 'bob-charge']);
  });
  it('includes voided charges and deduplicates by assignment, not session or student', () => {
    const voided = { ...charge('alice-charge', 'alice'), void_invoice_id: 'void-invoice' } as VoidInvoiceSession;
    const rows = combineBillingCharges([charge('alice-charge', 'alice'), charge('bob-charge', 'bob')], [voided]);
    expect(rows).toHaveLength(2);
    expect(rows[0].reason).toBe('voided');
    expect(rows[1].reason).toBe('uninvoiced');
  });
});
