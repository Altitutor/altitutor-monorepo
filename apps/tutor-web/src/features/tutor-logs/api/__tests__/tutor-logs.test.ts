import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { tutorLogsApi } from '../tutor-logs';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;

describe('tutorLogsApi.getUnloggedSessions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-04T00:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes conducting check-ins and excludes receiving or already logged check-ins', async () => {
    const sessions = [
      {
        session_id: 'class-1',
        session_type: 'CLASS',
        start_at: '2024-01-01T10:00:00Z',
      },
      {
        session_id: 'check-in-host',
        session_type: 'CHECK_IN',
        start_at: '2024-01-02T10:00:00Z',
        short_name: 'Hosted check-in',
      },
      {
        session_id: 'check-in-receiver',
        session_type: 'CHECK_IN',
        start_at: '2024-01-02T11:00:00Z',
      },
      {
        session_id: 'check-in-logged',
        session_type: 'CHECK_IN',
        start_at: '2024-01-03T10:00:00Z',
      },
    ];

    let requestedSessionTypes: string[] | null = null;
    const sessionQuery = {
      select: jest.fn(),
      in: jest.fn(),
      eq: jest.fn(),
      lte: jest.fn(),
      order: jest.fn().mockImplementation(async () => ({
        data:
          requestedSessionTypes == null
            ? sessions
            : sessions.filter((session) =>
                requestedSessionTypes?.includes(session.session_type),
              ),
        error: null,
      })),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.in.mockImplementation((column: string, values: string[]) => {
      if (column === 'session_type') requestedSessionTypes = values;
      return sessionQuery;
    });
    sessionQuery.eq.mockImplementation((column: string, value: string) => {
      if (column === 'session_type') requestedSessionTypes = [value];
      return sessionQuery;
    });
    sessionQuery.lte.mockReturnValue(sessionQuery);

    const logQuery = {
      select: jest.fn(),
      in: jest.fn().mockResolvedValue({
        data: [{ session_id: 'check-in-logged' }],
        error: null,
      }),
    };
    logQuery.select.mockReturnValue(logQuery);

    const detailQuery = {
      select: jest.fn(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            session_id: 'check-in-host',
            staff: [
              {
                id: 'staff-1',
                first_name: 'Host',
                last_name: 'Tutor',
                type: 'CHECK_IN_HOST',
              },
            ],
          },
          {
            session_id: 'check-in-receiver',
            staff: [
              {
                id: 'staff-1',
                first_name: 'Receiving',
                last_name: 'Tutor',
                type: 'CHECK_IN_RECEIVER',
              },
            ],
          },
        ],
        error: null,
      }),
    };
    detailQuery.select.mockReturnValue(detailQuery);

    const from = jest.fn((table: string) => {
      if (table === 'vtutor_sessions') return sessionQuery;
      if (table === 'vtutor_tutor_log') return logQuery;
      if (table === 'vtutor_session_detail') return detailQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    mockGetSupabaseClient.mockReturnValue(
      { from } as unknown as ReturnType<typeof getSupabaseClient>,
    );

    const result = await tutorLogsApi.getUnloggedSessions('staff-1');

    expect(result.map((session) => session.id)).toEqual([
      'class-1',
      'check-in-host',
    ]);
  });
});
