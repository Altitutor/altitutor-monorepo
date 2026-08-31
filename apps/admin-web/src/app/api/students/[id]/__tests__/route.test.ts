import { PATCH } from '../route';

const mockGetUser = jest.fn();
const mockStaffSingle = jest.fn();
const mockCurrentStudentSingle = jest.fn();
const mockUpdatedStudentSingle = jest.fn();
const mockStudentUpdate = jest.fn();

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

jest.mock('@/shared/lib/stripe/sync-customer', () => ({
  syncStudentToStripeCustomer: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'staff') {
        return {
          select: () => ({
            eq: () => ({ single: mockStaffSingle }),
          }),
        };
      }

      if (table === 'students') {
        return {
          select: () => ({
            eq: () => ({ single: mockCurrentStudentSingle }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    auth: { admin: { updateUserById: jest.fn() } },
    from: () => ({
      update: mockStudentUpdate,
    }),
  },
}));

describe('PATCH /api/students/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    });
    mockStaffSingle.mockResolvedValue({
      data: { role: 'ADMINSTAFF' },
      error: null,
    });
    mockCurrentStudentSingle.mockResolvedValue({
      data: { user_id: null, email: 'student@example.com' },
      error: null,
    });
    mockUpdatedStudentSingle.mockResolvedValue({
      data: { id: 'student-1', account_class: 'internal_test' },
      error: null,
    });
    mockStudentUpdate.mockReturnValue({
      eq: () => ({
        select: () => ({ single: mockUpdatedStudentSingle }),
      }),
    });
  });

  it('persists a valid Student account class', async () => {
    const response = await PATCH(
      {
        json: async () => ({ account_class: 'internal_test' }),
      } as never,
      { params: { id: 'student-1' } }
    );

    expect(response.status).toBe(200);
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ account_class: 'internal_test' })
    );
  });

  it('rejects an invalid Student account class', async () => {
    const response = await PATCH(
      {
        json: async () => ({ account_class: 'staff' }),
      } as never,
      { params: { id: 'student-1' } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid account_class. Must be external or internal_test.',
    });
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });
});
