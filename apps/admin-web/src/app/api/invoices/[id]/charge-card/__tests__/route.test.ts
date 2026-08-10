import { POST } from '../route';
import { captureApiError } from '@/lib/sentry/capture-api-error';

const mockPayInvoice = jest.fn();
const mockGetSession = jest.fn();
const mockStaffSingle = jest.fn();
const mockInvoiceSingle = jest.fn();

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

jest.mock('@/lib/sentry/capture-api-error', () => ({
  captureApiError: jest.fn(),
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

const captureApiErrorMock = jest.mocked(captureApiError);

describe('POST /api/invoices/[id]/charge-card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'staff-user' } } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: 'ADMINSTAFF', status: 'ACTIVE' },
      error: null,
    });
    mockInvoiceSingle.mockResolvedValue({
      data: { stripe_invoice_id: 'in_test', collection_method: 'charge_automatically' },
      error: null,
    });
  });

  it('returns an expected Stripe card decline without capturing it as an application error', async () => {
    mockPayInvoice.mockRejectedValue({
      type: 'StripeCardError',
      code: 'card_declined',
      statusCode: 402,
      message: 'Your card was declined.',
    });

    const response = await POST({} as never, { params: { id: 'invoice-id' } });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: 'Your card was declined.',
      code: 'card_declined',
    });
    expect(captureApiErrorMock).not.toHaveBeenCalled();
  });

  it('continues to capture unexpected Stripe failures as server errors', async () => {
    const error = new Error('Stripe unavailable');
    mockPayInvoice.mockRejectedValue(error);

    const response = await POST({} as never, { params: { id: 'invoice-id' } });

    expect(response.status).toBe(500);
    expect(captureApiErrorMock).toHaveBeenCalledWith(
      error,
      '/api/invoices/[id]/charge-card',
    );
  });
});
