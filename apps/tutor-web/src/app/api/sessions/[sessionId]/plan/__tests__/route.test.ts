/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { GET, PUT } from '../route';
import { createClient } from '@/shared/lib/supabase/server-ssr';

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/shared/lib/supabase/service-role', () => ({
  getServiceRoleClient: jest.fn(),
}));

const sessionID = '50000000-0000-0000-0000-000000000005';
function query(data: unknown) {
  const result = { data, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    in: () => chain,
    is: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

it('returns an empty optional plan for an assigned tutor without inventing logged delivery', async () => {
  jest.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'verified-user' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'vtutor_profile')
        return query({
          id: 'assigned-tutor',
          user_id: 'verified-user',
          status: 'ACTIVE',
          role: 'TUTOR',
        });
      if (table === 'vtutor_session_lesson_plans')
        return query({ session_id: sessionID, revision: 0, updated_at: null });
      return query([]);
    },
  } as never);
  const response = await GET(
    new NextRequest(`http://localhost/api/sessions/${sessionID}/plan`),
    { params: Promise.resolve({ sessionId: sessionID }) },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    sessionID,
    revision: 0,
    updatedAt: null,
    topics: [],
    resources: [],
  });
});

const context = { params: Promise.resolve({ sessionId: sessionID }) };
function clientFor(status = 'ACTIVE', assigned = true) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'verified-user' } },
        error: null,
      }),
    },
    from: (table: string) =>
      query(
        table === 'vtutor_profile'
          ? {
              id: 'assigned-tutor',
              user_id: 'verified-user',
              status,
              role: 'TUTOR',
            }
          : table === 'vtutor_session_lesson_plans'
            ? assigned
              ? { session_id: sessionID, revision: 0, updated_at: null }
              : null
            : [],
      ),
  };
}
function put(body: unknown) {
  return PUT(
    new NextRequest(`http://localhost/api/sessions/${sessionID}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  );
}
it('rejects unauthenticated and unassigned reads', async () => {
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  } as never);
  expect((await GET(new NextRequest('http://localhost'), context)).status).toBe(
    401,
  );
  jest
    .mocked(createClient)
    .mockResolvedValue(clientFor('ACTIVE', false) as never);
  expect((await GET(new NextRequest('http://localhost'), context)).status).toBe(
    404,
  );
});
it('rejects trial tutor writes and invalid selections before the service command', async () => {
  jest.mocked(createClient).mockResolvedValue(clientFor('TRIAL') as never);
  expect(
    (await put({ expectedRevision: 0, topicIds: [], fileIds: [] })).status,
  ).toBe(403);
  jest.mocked(createClient).mockResolvedValue(clientFor() as never);
  expect(
    (await put({ expectedRevision: -1, topicIds: [], fileIds: [] })).status,
  ).toBe(400);
  expect(
    (
      await put({
        expectedRevision: 0,
        topicIds: ['30000000-0000-0000-0000-000000000001'],
        fileIds: [],
      })
    ).status,
  ).toBe(403);
});
it('returns a conflict without replacing a newer saved plan', async () => {
  jest.mocked(createClient).mockResolvedValue(clientFor() as never);
  const rpc = jest.fn(async () => ({
    error: {
      code: 'PT409',
      message: 'This plan changed. Reload before saving.',
    },
  }));
  jest.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);
  const response = await put({
    expectedRevision: 0,
    topicIds: [],
    fileIds: [],
  });
  expect(response.status).toBe(409);
  expect(rpc).toHaveBeenCalledWith(
    'save_session_lesson_plan',
    expect.objectContaining({
      p_expected_revision: 0,
      p_session_id: sessionID,
    }),
  );
});

it('retries a read interleaved with another tutor save instead of returning stale content with a newer revision', async () => {
  let headers = 0;
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) },
    from: (table: string) => {
      if (table === 'vtutor_profile') return query({ id: 'assigned-tutor', user_id: 'verified-user', status: 'ACTIVE', role: 'TUTOR' });
      if (table === 'vtutor_session_lesson_plans') return query({ session_id: sessionID, revision: ++headers === 1 ? 1 : 2, updated_at: null });
      if (table === 'vtutor_session_lesson_plan_topics') return query([{id: '30000000-0000-0000-0000-000000000001', name: headers === 1 ? 'Old plan' : 'Shared update', code: null}]);
      return query([]);
    },
  } as never);
  const response = await GET(new NextRequest('http://localhost'), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(expect.objectContaining({ revision: 2, topics: [{id: '30000000-0000-0000-0000-000000000001', name: 'Shared update', code: null}] }));
});
