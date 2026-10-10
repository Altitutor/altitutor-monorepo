import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { sessionsApi } from '../sessions';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const fixtures = [
  { session_id: 'active', session_type: 'CLASS', start_at: '2026-01-01T01:00:00Z', staff: [], students: [], parents: [] },
  { session_id: 'inactive', session_type: 'CLASS', start_at: '2026-01-01T01:00:00Z', staff: [], students: [], parents: [] },
  { session_id: 'tombstone', session_type: 'CLASS', start_at: '2026-01-01T01:00:00Z', staff: [], students: [], parents: [] },
];

beforeEach(() => {
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: (view: string) => {
      const rows = view.includes('_operational_') ? fixtures.slice(0, 1) : fixtures;
      const query = {
        select: () => query, gte: () => query, lte: () => query,
        filter: () => query, not: () => query, order: () => query,
        limit: () => query, in: () => query,
        then: (resolve: (value: { data: typeof rows; error: null }) => unknown) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  } as unknown as ReturnType<typeof getSupabaseClient>);
});

it.each([
  ['general list', () => sessionsApi.getAllSessions()],
  ['date range', () => sessionsApi.getSessionsInDateRange('2026-01-01', '2026-01-01')],
  ['moved sessions', () => sessionsApi.getSessionsOriginallyInDateRange('2026-01-01', '2026-01-01')],
  ['past sessions', () => sessionsApi.getPastSessionsWithDetails()],
] as const)('%s uses the lifecycle-filtered facade', async (_name, read) => {
  expect((await read()).map(row => row.session_id)).toEqual(['active']);
});

it('batch details exclude cancelled session rosters', async () => {
  expect(Object.keys(await sessionsApi.getSessionsWithDetails(['active', 'inactive', 'tombstone']))).toEqual(['active']);
});
