import { POST } from '../route';

const mockSession = jest.fn();
const mockRpc = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200, json: async () => body,
  }) },
}));
jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-user' } }, error: null }) },
    rpc: async (name: string) => ({ data: name === 'is_adminstaff_active' ? true : 'admin-staff', error: null }),
  }),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: table === 'sessions' ? mockSession : async () => ({ data: { id: 'assignment' }, error: null }),
      };
      return query;
    },
    rpc: mockRpc,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:55321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-placeholder';
  mockSession.mockResolvedValue({ data: { id: 'session', status: 'ACTIVE', calendar_tombstone_until: null }, error: null });
  mockRpc.mockResolvedValue({ data: { success: true, tutor_log_id: 'log' }, error: null });
});

function submit() {
  return POST({ json: async () => ({ data: { sessionId: 'session' }, loggedForStaffId: 'assigned-tutor' }) } as Request);
}

it.each([
  ['INACTIVE', null],
  ['ACTIVE', '2026-12-01T00:00:00Z'],
])('rejects %s session with tombstone %s before creating a log', async (status, tombstone) => {
  mockSession.mockResolvedValue({ data: { id: 'session', status, calendar_tombstone_until: tombstone }, error: null });
  const response = await submit();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Cannot log an inactive or cancelled session.' });
  expect(mockRpc).not.toHaveBeenCalled();
});

it('accepts an active session and preserves admin submitter and assigned tutor attribution', async () => {
  expect((await submit()).status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith('create_tutor_log', expect.objectContaining({
    p_created_by: 'admin-staff', p_logged_for_staff_id: 'assigned-tutor',
  }));
});

it('reports cancellation if the session changes after the API precheck', async () => {
  mockRpc.mockResolvedValue({ data: { success: false, error: 'Cannot log an inactive or cancelled session.' }, error: null });
  const response = await submit();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Cannot log an inactive or cancelled session.' });
});
