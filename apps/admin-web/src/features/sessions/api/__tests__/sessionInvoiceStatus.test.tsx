import { render, screen } from '@testing-library/react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getInvoiceStatusBadge } from '@/features/billing/utils/invoiceFormatters';
import { sessionsApi } from '../sessions';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));
const mockClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;
const invoice = {
  id: 'invoice-1',
  status: 'paid',
  paid_at: '2026-10-01',
  credited_at: null,
  deleted_at: null,
};
const notes = [
  {
    invoice_id: 'invoice-1',
    status: 'issued',
    amount_cents: 4500,
    credit_amount_cents: 4500,
    refund_amount_cents: 0,
    created_at: '2026-10-07',
  },
  {
    invoice_id: 'invoice-1',
    status: 'void',
    amount_cents: 4500,
    credit_amount_cents: 0,
    refund_amount_cents: 4500,
    created_at: '2026-10-06',
  },
];
const student = {
  id: 'student-1',
  first_name: 'Test',
  last_name: 'Student',
  sessions_students_id: 'ss-1',
  invoice_status_payload: {
    invoice_id: 'invoice-1',
    status: 'paid',
    paid_at: '2026-10-01',
    credited_at: null,
  },
};
const session = { id: 'session-1', class_id: null, type: 'ADMIN_SHIFT' };

function clientFixture() {
  const rows: Record<string, unknown> = {
    sessions: session,
    sessions_students: [{ id: 'ss-1', student_id: 'student-1', student }],
    invoice_items: [
      { sessions_students_id: 'ss-1', invoice_id: 'invoice-1', invoice },
    ],
    credit_notes: notes,
    tutor_logs: null,
  };
  return {
    rpc: jest.fn(async () => ({
      data: {
        sessions: [session],
        sessionStudents: { 'session-1': [student] },
      },
      error: null,
    })),
    from: jest.fn((table: string) => {
      const response = Promise.resolve({
        data: rows[table] ?? [],
        error: null,
      });
      const query = Object.assign(response, {
        select: () => query,
        eq: () => query,
        in: () => query,
        is: () => query,
        order: () => query,
        single: () => query,
        maybeSingle: () => query,
      });
      return query;
    }),
  };
}

it.each(['detail', 'table'] as const)(
  'shows Paid and Credited from active credit notes in the session %s',
  async (view) => {
    mockClient.mockReturnValue(
      clientFixture() as unknown as ReturnType<typeof getSupabaseClient>,
    );
    const payload =
      view === 'detail'
        ? (await sessionsApi.getSessionWithTutorLog('session-1'))
            .sessionsStudents[0].invoice_status_payload
        : (await sessionsApi.getAllSessionsWithDetails()).sessionStudents[
            'session-1'
          ][0].invoice_status_payload;
    render(getInvoiceStatusBadge(payload));
    expect(screen.getByText('Paid (1 Oct)')).toBeInTheDocument();
    expect(screen.getByText('Credited (7 Oct)')).toBeInTheDocument();
    expect(screen.queryByText(/Refunded/)).not.toBeInTheDocument();
  },
);
