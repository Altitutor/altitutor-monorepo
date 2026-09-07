/**
 * Regression for ADMIN-WEB-1B: duplicate sessions_staff insert must not
 * surface unique-constraint "sessions_staff_unique_session_staff" as an
 * unhandled crash. Same session_id + staff_id is one assignment.
 */

import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { sessionsApi } from '../sessions';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const UNIQUE_VIOLATION = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "sessions_staff_unique_session_staff"',
};

function assignmentRow(payload: TablesInsert<'sessions_staff'>): Tables<'sessions_staff'> {
  return {
    id: payload.id ?? 'generated-id',
    session_id: payload.session_id,
    staff_id: payload.staff_id,
    type: payload.type ?? 'MAIN_TUTOR',
    planned_absence: false,
    planned_absence_logged_at: null,
    planned_absence_logged_by: null,
    is_swapped: false,
    swapped_at: null,
    swapped_sessions_staff_id: null,
    created_at: '2026-09-05T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
    created_by: null,
    was_trial: false,
  };
}

function createUniqueConstrainedSessionsStaffClient() {
  const rows: Tables<'sessions_staff'>[] = [];

  const from = jest.fn((table: string) => {
    if (table !== 'sessions_staff') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert(payload: TablesInsert<'sessions_staff'>) {
        return {
          select() {
            return {
              async single() {
                const duplicate = rows.some(
                  (row) =>
                    row.session_id === payload.session_id && row.staff_id === payload.staff_id
                );
                if (duplicate) {
                  return { data: null, error: UNIQUE_VIOLATION };
                }
                const row = assignmentRow(payload);
                rows.push(row);
                return { data: row, error: null };
              },
            };
          },
        };
      },
      select() {
        let sessionId: string | undefined;
        let staffId: string | undefined;
        const query = {
          eq(column: string, value: string) {
            if (column === 'session_id') sessionId = value;
            if (column === 'staff_id') staffId = value;
            return query;
          },
          async single() {
            const match = rows.find(
              (row) => row.session_id === sessionId && row.staff_id === staffId
            );
            if (!match) {
              return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
            }
            return { data: match, error: null };
          },
        };
        return query;
      },
    };
  });

  return { from, rows };
}

describe('sessionsApi.assignStaffToSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let uuidSeq = 0;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: () => `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, '0')}`,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the existing assignment when the same staff is assigned twice (no unique-constraint crash)', async () => {
    const client = createUniqueConstrainedSessionsStaffClient();
    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>
    );

    const sessionId = 'session-1';
    const staffId = 'staff-1';

    const first = await sessionsApi.assignStaffToSession(sessionId, staffId, 'MAIN_TUTOR');
    expect(first.session_id).toBe(sessionId);
    expect(first.staff_id).toBe(staffId);
    expect(first.type).toBe('MAIN_TUTOR');
    expect(client.rows).toHaveLength(1);

    const second = await sessionsApi.assignStaffToSession(sessionId, staffId, 'MAIN_TUTOR');

    expect(second.id).toBe(first.id);
    expect(second.session_id).toBe(sessionId);
    expect(second.staff_id).toBe(staffId);
    expect(client.rows).toHaveLength(1);
  });

  it('still throws unrelated insert errors', async () => {
    const permissionError = { code: '42501', message: 'permission denied for table sessions_staff' };
    const from = jest.fn(() => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: permissionError }),
        }),
      }),
    }));
    mockGetSupabaseClient.mockReturnValue(
      { from } as unknown as ReturnType<typeof getSupabaseClient>
    );

    await expect(
      sessionsApi.assignStaffToSession('session-1', 'staff-1', 'MAIN_TUTOR')
    ).rejects.toMatchObject(permissionError);
  });
});
