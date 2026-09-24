import { recordInvoiceOperatorEvent } from '../recordInvoiceOperatorEvent';

const mockRpc = jest.fn();

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('recordInvoiceOperatorEvent', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('records the staff action against the invoice without storing recipient emails', async () => {
    await recordInvoiceOperatorEvent({
      invoiceId: 'invoice-1',
      studentId: 'student-1',
      eventName: 'invoice.notification_sent',
      actorStaffId: 'staff-1',
      payload: { recipient_count: 2 },
    });

    expect(mockRpc).toHaveBeenCalledWith('record_domain_event', {
      p_event_name: 'invoice.notification_sent',
      p_subject_type: 'invoice',
      p_subject_id: 'invoice-1',
      p_entities: [{ entity_type: 'student', entity_id: 'student-1', role: 'related' }],
      p_payload: { recipient_count: 2 },
      p_actor_staff_id: 'staff-1',
      p_source: 'application',
    });
  });

  it('still records the event when no student is linked', async () => {
    await recordInvoiceOperatorEvent({
      invoiceId: 'invoice-1',
      eventName: 'invoice.payment_attempted',
      actorStaffId: 'staff-1',
      payload: { outcome: 'declined' },
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'record_domain_event',
      expect.objectContaining({
        p_entities: [],
        p_payload: { outcome: 'declined' },
      })
    );
  });
});
