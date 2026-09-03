import { POST } from '../route';

const mockGetUser = jest.fn();
const mockStaffMaybeSingle = jest.fn();
const mockRpc = jest.fn();

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
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== 'staff') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: mockStaffMaybeSingle }),
        }),
      };
    },
  }),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

const creditOperation = {
  student_id: 'student-1',
  original_sessions_students_id: 'assignment-1',
  action: 'credit',
};

const rescheduleOperation = {
  student_id: 'student-1',
  original_sessions_students_id: 'assignment-2',
  action: 'reschedule',
  target_session_id: 'session-3',
};

describe('POST /api/absences/log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    });
    mockStaffMaybeSingle.mockResolvedValue({
      data: { id: 'staff-1', role: 'ADMINSTAFF', status: 'ACTIVE' },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: { success: true, operations: [creditOperation, rescheduleOperation] },
      error: null,
    });
  });

  it('submits credit and reschedule decisions together through the billing-aware command', async () => {
    const operations = [creditOperation, rescheduleOperation];

    const response = await POST({
      json: async () => ({
        operations,
        reasonCategory: 'approved_absence',
        reasonNote: 'Family provided notice',
      }),
    } as Request);

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('log_student_absences_with_billing', {
      operations,
      logged_by_staff_id: 'staff-1',
      reason_category: 'approved_absence',
      reason_note: 'Family provided notice',
    });
  });

  it.each([
    { name: 'an empty batch', operations: [] },
    { name: 'an unknown action', operations: [{ ...creditOperation, action: 'cancel' }] },
  ])('rejects $name before invoking the billing command', async ({ operations }) => {
    const response = await POST({
      json: async () => ({ operations, reasonCategory: 'approved_absence' }),
    } as Request);

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
