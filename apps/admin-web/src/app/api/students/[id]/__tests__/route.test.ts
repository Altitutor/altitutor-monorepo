import { PATCH } from '../route';
import { captureApiError } from '@/lib/sentry/capture-api-error';

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
      { params: Promise.resolve({ id: 'student-1' }) }
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
      { params: Promise.resolve({ id: 'student-1' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid account_class. Must be external or internal_test.',
    });
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });

  it('explains a duplicate Student phone as a conflict without exposing record identifiers', async () => {
    mockUpdatedStudentSingle.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'Phone number +61400000000 is already associated with another student (ID: 00000000-0000-0000-0000-000000000001)',
      },
    });

    const response = await PATCH(
      { json: async () => ({ phone: '+61400000000' }) } as never,
      { params: Promise.resolve({ id: 'student-1' }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'This phone number is already linked to another student. Use a different number, or check the other student\'s contact details.',
    });
    expect(captureApiError).not.toHaveBeenCalled();
  });

  it('keeps unexpected Student update failures visible', async () => {
    const failure = { code: '42501', message: 'permission denied for table students' };
    mockUpdatedStudentSingle.mockResolvedValue({ data: null, error: failure });

    const response = await PATCH(
      { json: async () => ({ first_name: 'Ada' }) } as never,
      { params: Promise.resolve({ id: 'student-1' }) }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to update student: permission denied for table students' });
    expect(captureApiError).toHaveBeenCalledWith(failure, '/api/students/[id]');
  });
});
