import { POST } from '../route';
import { captureException } from '@sentry/nextjs';

const mockPayInvoice = jest.fn();
const mockGetSession = jest.fn();
const mockStaffSingle = jest.fn();
const mockInvoiceSingle = jest.fn();
const mockRecordDomainEvent = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    invoices: {
      pay: mockPayInvoice,
    },
  })),
);

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRecordDomainEvent(...args),
  },
}));

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
    from: (table: string) => {
      if (table === 'staff') {
        return {
          select: () => ({
            eq: () => ({
              single: mockStaffSingle,
            }),
          }),
        };
      }

      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                single: mockInvoiceSingle,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

const captureApiErrorMock = jest.mocked(captureException);

describe('POST /api/invoices/[id]/charge-card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'staff-user' } } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { id: 'staff-1', role: 'ADMINSTAFF', status: 'ACTIVE' },
      error: null,
    });
    mockInvoiceSingle.mockResolvedValue({
      data: {
        stripe_invoice_id: 'in_test',
        collection_method: 'charge_automatically',
        student_id: 'student-1',
      },
      error: null,
    });
    mockRecordDomainEvent.mockResolvedValue({ error: null });
  });

  it.each(['charge_automatically', 'send_invoice'])(
    'returns an expected %s card decline without capturing it as an application error',
    async (collectionMethod) => {
      mockInvoiceSingle.mockResolvedValue({
        data: {
          stripe_invoice_id: 'in_test',
          collection_method: collectionMethod,
          student_id: 'student-1',
        },
      });
      mockPayInvoice.mockRejectedValue({
        type: 'StripeCardError',
        code: 'card_declined',
        statusCode: 402,
        message: 'Your card was declined.',
      });

      const response = await POST({} as never, {
        params: Promise.resolve({ id: 'invoice-id' }),
      });

      expect(response.status).toBe(402);
      await expect(response.json()).resolves.toEqual({
        error: 'Your card was declined.',
        code: 'card_declined',
      });
      expect(captureApiErrorMock).not.toHaveBeenCalled();
      expect(mockRecordDomainEvent).toHaveBeenCalledWith(
        'record_domain_event',
        expect.objectContaining({
          p_subject_id: 'invoice-id',
          p_event_name: 'invoice.payment_attempted',
          p_actor_staff_id: 'staff-1',
          p_payload: {
            outcome: 'declined',
            error_code: 'card_declined',
          },
        }),
      );
    },
  );

  it.each(['TUTOR', 'STUDENT'])(
    'rejects a %s without attempting payment',
    async (role) => {
      mockStaffSingle.mockResolvedValue({
        data: { id: 'staff-1', role, status: 'ACTIVE' },
      });
      const response = await POST({} as never, {
        params: Promise.resolve({ id: 'invoice-id' }),
      });
      expect(response.status).toBe(403);
      expect(mockPayInvoice).not.toHaveBeenCalled();
    },
  );

  it.each(['charge_automatically', 'send_invoice'])(
    'attempts payment on the existing %s invoice',
    async (collectionMethod) => {
      mockInvoiceSingle.mockResolvedValue({
        data: {
          stripe_invoice_id: 'in_test',
          collection_method: collectionMethod,
          student_id: 'student-1',
        },
        error: null,
      });
      mockPayInvoice.mockResolvedValue({
        id: 'in_test',
        status: 'paid',
      });

      const response = await POST({} as never, {
        params: Promise.resolve({ id: 'invoice-id' }),
      });

      expect(response.status).toBe(200);
      expect(mockPayInvoice).toHaveBeenCalledWith('in_test');
      expect(mockRecordDomainEvent).toHaveBeenCalledWith(
        'record_domain_event',
        expect.objectContaining({
          p_subject_id: 'invoice-id',
          p_event_name: 'invoice.payment_attempted',
          p_actor_staff_id: 'staff-1',
          p_payload: {
            outcome: 'succeeded',
            stripe_status: 'paid',
          },
        }),
      );
    },
  );

  it('continues to capture unexpected Stripe failures as server errors', async () => {
    const error = new Error('Stripe unavailable');
    mockPayInvoice.mockRejectedValue(error);

    const response = await POST({} as never, { params: Promise.resolve({ id: 'invoice-id' }) });

    expect(response.status).toBe(500);
    expect(captureApiErrorMock).toHaveBeenCalledWith(error, {
      tags: {
        'api.handled': 'true',
        'api.route': '/api/invoices/[id]/charge-card',
      },
    });
    expect(mockRecordDomainEvent).not.toHaveBeenCalled();
  });
});
