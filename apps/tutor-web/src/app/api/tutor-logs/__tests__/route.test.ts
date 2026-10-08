import type { NextRequest } from 'next/server';
import { POST } from '../route';

const mockSession = jest.fn();
const mockRpc = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200, json: async () => body,
  }) },
}));
jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('@/features/pay-tier/server/fetchPayTierProgress', () => ({ fetchPayTierProgressForStaff: jest.fn() }));
jest.mock('@/features/pay-tier/server/ensurePayTierEligibilityNotification', () => ({ ensurePayTierEligibilityNotification: jest.fn() }));
jest.mock('@/shared/lib/supabase/service-role', () => ({ getServiceRoleClient: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    rpc: async (name: string) => ({ data: name === 'is_tutor' ? true : 'tutor-staff', error: null }),
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: table === 'vtutor_sessions' ? mockSession : async () => ({ data: null, error: null }),
      };
      return query;
    },
  }),
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mockRpc }) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:55321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-placeholder';
  mockSession.mockResolvedValue({ data: {
    session_id: 'session', session_type: 'CLASS', start_at: '2024-01-01T00:00:00Z',
    session_status: 'ACTIVE', calendar_tombstone_until: null,
  }, error: null });
  mockRpc.mockResolvedValue({ data: { success: true, tutor_log_id: 'log' }, error: null });
});

function submit() {
  return POST({ json: async () => ({ sessionId: 'session' }) } as NextRequest);
}

it.each([
  ['INACTIVE', null],
  ['ACTIVE', '2026-12-01T00:00:00Z'],
])('rejects %s session with tombstone %s before creating a log', async (status, tombstone) => {
  mockSession.mockResolvedValue({ data: {
    session_id: 'session', session_type: 'CLASS', start_at: '2024-01-01T00:00:00Z',
    session_status: status, calendar_tombstone_until: tombstone,
  }, error: null });
  const response = await submit();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Cannot log an inactive or cancelled session.' });
  expect(mockRpc).not.toHaveBeenCalled();
});

it('allows an active session assigned to the authenticated tutor', async () => {
  expect((await submit()).status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith('create_tutor_log', expect.objectContaining({
    p_created_by: 'tutor-staff', p_logged_for_staff_id: 'tutor-staff',
  }));
});

it('reports cancellation if the session changes after the API precheck', async () => {
  mockRpc.mockResolvedValue({ data: { success: false, error: 'Cannot log an inactive or cancelled session.' }, error: null });
  const response = await submit();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Cannot log an inactive or cancelled session.' });
});
