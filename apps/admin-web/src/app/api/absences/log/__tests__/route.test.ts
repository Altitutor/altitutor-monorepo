import { POST } from '../route';

const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
const mockStaffMaybeSingle = jest.fn();
const mockRpc = jest.fn();
const mockFetch = jest.fn();

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
    auth: { getUser: mockGetUser, getSession: mockGetSession },
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
    global.fetch = mockFetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'admin-access-token',
          user: { id: 'admin-user' },
        },
      },
      error: null,
    });
    mockStaffMaybeSingle.mockResolvedValue({
      data: { id: 'staff-1', role: 'ADMINSTAFF', status: 'ACTIVE' },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        operations: [creditOperation, rescheduleOperation],
        billing_adjustment_ids: ['adjustment-credit', 'adjustment-replacement'],
      },
      error: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        adjustmentsOnly: true,
        adjustments: { claimed: 1, succeeded: 1, failed: 0 },
      }),
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
    expect(mockFetch).toHaveBeenCalledWith(
      'http://supabase.test/functions/v1/billing-runner',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer service-role-test-key',
          apikey: 'service-role-test-key',
          'x-admin-token': 'admin-access-token',
        }),
        body: JSON.stringify({
          adjustmentsOnly: true,
          adjustmentIds: ['adjustment-credit', 'adjustment-replacement'],
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        billing: {
          status: 'processed',
          claimed: 1,
          succeeded: 1,
          failed: 0,
        },
      }),
    );
  });

  it('keeps the saved absence successful and queues a retry when immediate billing fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('billing runner timed out'));

    const response = await POST({
      json: async () => ({
        operations: [creditOperation],
        reasonCategory: 'approved_absence',
      }),
    } as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        billing: { status: 'queued' },
        warning: 'Absence saved; billing queued for retry.',
      }),
    );
  });

  it.each([
    {
      name: 'the runner lock is already held',
      response: { ok: true, status: 200, json: async () => ({ ok: true, skipped: true }) },
    },
    {
      name: 'the runner response is malformed',
      response: { ok: true, status: 200, json: async () => ({ ok: true }) },
    },
    {
      name: 'the runner reports an unsuccessful request',
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          ok: false,
          adjustmentsOnly: true,
          adjustments: { claimed: 0, succeeded: 0, failed: 0 },
        }),
      },
    },
    {
      name: 'one of the targeted adjustments fails',
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          adjustmentsOnly: true,
          adjustments: { claimed: 1, succeeded: 0, failed: 1 },
        }),
      },
    },
  ])('queues durable work when $name', async ({ response: billingResponse }) => {
    mockFetch.mockResolvedValueOnce(billingResponse);

    const response = await POST({
      json: async () => ({
        operations: [creditOperation],
        reasonCategory: 'approved_absence',
      }),
    } as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        billing: { status: 'queued' },
        warning: 'Absence saved; billing queued for retry.',
      }),
    );
  });

  it('does not invoke billing when the absence creates no financial adjustment', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, operations: [creditOperation], billing_adjustment_ids: [] },
      error: null,
    });

    const response = await POST({
      json: async () => ({
        operations: [creditOperation],
        reasonCategory: 'approved_absence',
      }),
    } as Request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        billing: { status: 'not_required' },
      }),
    );
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
