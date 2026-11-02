/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getAllClasses, getStudentsBySessionDate } from '../bulk';
import { fetchFamilyCheckInsData } from '@/features/reconciliation/api/familyCheckIns';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

beforeEach(() => {
  const client = createClient<Database>('https://synthetic.invalid', 'test-only', {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      const table = url.pathname.split('/').pop();
      const unsupported = table !== 'students' && url.searchParams.has('deleted_at');
      const body = unsupported ? { code: '42703', message: `column ${table}.deleted_at does not exist` }
        : table === 'sessions' ? [{ id: 'session' }]
        : table === 'sessions_students' ? [
          { student: { id: 'live', status: 'ACTIVE', deleted_at: null } },
          { student: { id: 'retired', status: 'ACTIVE', deleted_at: '2026-01-01' } },
        ] : [];
      return new Response(JSON.stringify(body), { status: unsupported ? 400 : 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  jest.mocked(getSupabaseClient).mockReturnValue(client);
});

it('loads Class choices without filtering a nonexistent Class column', async () => {
  await expect(getAllClasses()).resolves.toEqual([]);
});
it('loads Family Check-ins staff without filtering a nonexistent Staff column', async () => {
  await expect(fetchFamilyCheckInsData()).resolves.toEqual({ staff: [], students: [], parents: [] });
});
it('loads session-date recipients and excludes deleted Students through the Student record', async () => {
  expect((await getStudentsBySessionDate('2026-01-01')).map(student => student.id)).toEqual(['live']);
});
