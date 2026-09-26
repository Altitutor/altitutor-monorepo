import { GET } from '../route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const DROPPED_COLUMN_ERROR =
  'column student_question_attempts.question_answer_option_id does not exist';

const mockGetUser = jest.fn();
const mockRpc = jest.fn();
let practiceAnswerFilter = '';

jest.mock('@/lib/sentry/capture-api-error', () => ({
  captureApiError: jest.fn(),
  captureApiErrorResponse: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function queryResult(table: string): QueryResult {
  if (table === 'staff') {
    return {
      data: { id: 'staff-1', role: 'ADMINSTAFF', status: 'ACTIVE' },
      error: null,
    };
  }

  if (table === 'students') {
    return {
      data: [
        {
          id: 'student-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          status: 'active',
          timezone: 'Australia/Adelaide',
        },
      ],
      error: null,
    };
  }

  if (table === 'ucat_subscription_config') {
    return {
      data: {
        free_practice_limit: 20,
        free_practice_period: 'day',
        free_sets_limit: 0,
        free_mocks_limit: 0,
        free_learn_limit: 0,
        free_skill_trainer_limit: 0,
      },
      error: null,
    };
  }

  if (table === 'student_question_attempts') {
    if (practiceAnswerFilter.includes('question_answer_option_id')) {
      return { data: null, error: { message: DROPPED_COLUMN_ERROR } };
    }
    return {
      data: [{ question_id: 'q-1' }, { question_id: 'q-1' }, { question_id: 'q-2' }],
      error: null,
    };
  }

  throw new Error(`Unexpected table: ${table}`);
}

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  or: (filter: unknown) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  then: Promise<QueryResult>['then'];
};

function queryBuilder(table: string): QueryBuilder {
  const promise = Promise.resolve(queryResult(table));
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    gte: () => builder,
    not: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    or: (filter: unknown) => {
      if (table === 'student_question_attempts' && typeof filter === 'string') {
        practiceAnswerFilter = filter;
      }
      return builder;
    },
    maybeSingle: () => promise,
    then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
  };
  return builder;
}

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => queryBuilder(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('GET /api/ucat/free-tier-quotas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    practiceAnswerFilter = '';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    });
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_student_ucat_online_tier') return { data: 'free', error: null };
      if (name === 'get_ucat_free_quota_reset_boundary') return { data: null, error: null };
      throw new Error(`Unexpected rpc: ${name}`);
    });
  });

  it('counts distinct answered practice questions without the removed option column', async () => {
    const response = await GET({
      nextUrl: { searchParams: new URLSearchParams() },
    } as never);

    if (!response) {
      throw new Error('Expected a response');
    }

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{ quotas: Array<{ area: string; used: number }> }>;
    };
    expect(body.rows[0]?.quotas.find((quota) => quota.area === 'practice')?.used).toBe(2);
    expect(practiceAnswerFilter).toBe('answer_snapshot.not.is.null,is_submitted.eq.true');
    expect(practiceAnswerFilter).not.toContain('question_answer_option_id');
  });
});
