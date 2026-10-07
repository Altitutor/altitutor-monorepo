import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { sessionsApi } from '../sessions';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const mockClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const duplicate = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "sessions_students_unique_session_student"',
};

function uniqueConstrainedClient() {
  const rows: Tables<'sessions_students'>[] = [];
  return {
    rows,
    from: jest.fn((table: string) => {
      if (table !== 'sessions_students') throw new Error(`Unexpected table: ${table}`);
      return {
        insert: (payload: TablesInsert<'sessions_students'>) => ({
          select: () => ({
            single: async () => {
              if (rows.some(row => row.session_id === payload.session_id && row.student_id === payload.student_id)) {
                return { data: null, error: duplicate };
              }
              const row = { ...payload, planned_absence: false, is_rescheduled: false, is_credited: false } as Tables<'sessions_students'>;
              rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
      };
    }),
  };
}

describe('sessionsApi.addStudentToSession duplicate protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let sequence = 0;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('explains an existing assignment from stale client state and preserves the original row', async () => {
    const client = uniqueConstrainedClient();
    mockClient.mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
    const first = await sessionsApi.addStudentToSession('session-1', 'student-1');
    await expect(sessionsApi.addStudentToSession('session-1', 'student-1')).rejects.toThrow('This student is already in this session.');
    expect(client.rows).toEqual([first]);
  });

  it('allows only one assignment when stale callers race to add the same student', async () => {
    const client = uniqueConstrainedClient();
    mockClient.mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
    const results = await Promise.allSettled([
      sessionsApi.addStudentToSession('session-1', 'student-1'),
      sessionsApi.addStudentToSession('session-1', 'student-1'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected).toMatchObject({ status: 'rejected', reason: new Error('This student is already in this session.') });
    expect(client.rows).toHaveLength(1);
  });

  it('preserves unrelated database errors rather than labelling them as an existing participant', async () => {
    const unrelated = { code: '23505', message: 'duplicate key value violates unique constraint "sessions_students_pkey"' };
    mockClient.mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: unrelated }) }) }) }),
    } as unknown as ReturnType<typeof getSupabaseClient>);
    await expect(sessionsApi.addStudentToSession('session-1', 'student-1')).rejects.toBe(unrelated);
  });
});
