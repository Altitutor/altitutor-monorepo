/** @jest-environment node */
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { GET, POST } from './route';

jest.mock('@/shared/lib/supabase/server', () => ({ getServerSupabaseAdmin: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: jest.fn() }));
jest.mock('@/shared/lib/forms/resolve-form-blocks', () => ({ resolveFormBlocks: jest.fn().mockResolvedValue([]) }));

const sessions = [
  { id: 'active', class_id: 'class', start_at: '2026-01-02T01:00:00Z', status: 'ACTIVE', calendar_tombstone_until: null },
  { id: 'inactive', class_id: 'class', start_at: '2026-01-02T02:00:00Z', status: 'INACTIVE', calendar_tombstone_until: null },
  { id: 'tombstone', class_id: 'class', start_at: '2026-01-02T03:00:00Z', status: 'ACTIVE', calendar_tombstone_until: '2026-03-01T00:00:00Z' },
];
const rpc = jest.fn().mockResolvedValue({ data: { success: true, scheduled: true }, error: null });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
  rpc.mockClear();
  jest.mocked(createClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) },
  } as unknown as ReturnType<typeof createClient>);
  jest.mocked(getServerSupabaseAdmin).mockReturnValue({
    rpc,
    from: (table: string) => {
      const data: Record<string, Record<string, unknown>[]> = {
        form_tokens: [{ id: 'token', access_type: 'authenticated', revoked_at: null, metadata: {}, forms: { id: 'form', name: 'Exit', purpose: 'exit', status: 'published' }, form_versions: { id: 'version', blocks: [], version_number: 1 } }],
        students: [{ id: 'student', user_id: 'user' }],
        student_exit_requests: [{ id: 'request', form_token_id: 'token', student_id: 'student', status: 'pending', workflow_key: 'student_unenrolment' }],
        student_exit_request_enrolments: [{ id: 'enrolment', student_exit_request_id: 'request', classes_students: { class_id: 'class', classes: { id: 'class' } } }],
        sessions,
      };
      let rows = data[table] ?? [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (key !== 'token_hash') rows = rows.filter(row => row[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
        gt: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) > value); return query; },
        lte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) <= value); return query; },
        order: () => query,
        limit: (limit: number) => { rows = rows.slice(0, limit); return query; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (value: { data: typeof rows; error: null }) => unknown) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  } as unknown as ReturnType<typeof getServerSupabaseAdmin>);
});
afterEach(() => jest.useRealTimers());

it('offers only active non-tombstoned final sessions', async () => {
  const response = await GET(new Request('http://localhost/form/token'), { params: { token: 'token' } });
  expect(response.status).toBe(200);
  expect((await response.json()).exitRequest.sessions.map((row: { id: string }) => row.id)).toEqual(['active']);
});

it.each(['inactive', 'tombstone'])('rejects a stale %s final-session selection without completing the request', async sessionId => {
  const response = await POST(new Request('http://localhost/form/token', {
    method: 'POST', body: JSON.stringify({ answers: {}, exitSelections: [{ requestEnrolmentId: 'enrolment', sessionId }] }),
  }), { params: { token: 'token' } });
  expect(response.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

it('completes a valid active final-session selection', async () => {
  const response = await POST(new Request('http://localhost/form/token', {
    method: 'POST', body: JSON.stringify({ answers: {}, exitSelections: [{ requestEnrolmentId: 'enrolment', sessionId: 'active' }] }),
  }), { params: { token: 'token' } });
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('complete_student_exit_request', expect.objectContaining({
    p_exit_selections: [{ requestEnrolmentId: 'enrolment', finalSessionAt: sessions[0].start_at }],
  }));
});
