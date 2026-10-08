import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { absencesApi } from '../absences';
import { staffAbsencesApi } from '../staff-absences';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

beforeEach(() => {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: () => {
      let rows = [
        { id: 'active', session: { id: 'active', start_at: start, status: 'ACTIVE', calendar_tombstone_until: null } },
        { id: 'inactive', session: { id: 'inactive', start_at: start, status: 'INACTIVE', calendar_tombstone_until: null } },
        { id: 'cancelled', session: { id: 'cancelled', start_at: start, status: 'ACTIVE', calendar_tombstone_until: start } },
      ];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (key === 'session.status') rows = rows.filter(row => row.session.status === value);
          return query;
        },
        is: (key: string, value: unknown) => {
          if (key === 'session.calendar_tombstone_until') rows = rows.filter(row => row.session.calendar_tombstone_until === value);
          return query;
        },
        gte: () => query,
        then: (resolve: (value: { data: typeof rows; error: null }) => unknown) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  } as unknown as ReturnType<typeof getSupabaseClient>);
});

it('student absence picker excludes inactive and tombstoned sessions', async () => {
  expect((await absencesApi.getStudentFutureSessions('student')).map(row => row.id)).toEqual(['active']);
});

it('staff absence picker excludes inactive and tombstoned sessions', async () => {
  expect((await staffAbsencesApi.getStaffFutureSessions('staff')).map(row => row.id)).toEqual(['active']);
});
