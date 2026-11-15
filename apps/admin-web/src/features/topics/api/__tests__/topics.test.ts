/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { topicsApi } from '../topics';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

it('keeps the active topic detail refetch free of HTTP errors after subtree deletion', async () => {
  let deleted = false;
  const statuses: number[] = [];
  const client = createClient<Database>('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/topics');
      expect(url.searchParams.get('id')).toBe('eq.parent-topic');
      const method = init?.method ?? 'GET';
      let status = 200;
      let body: unknown = [{ id: 'parent-topic' }];
      if (method === 'DELETE') { deleted = true; status = 204; body = null; }
      else if (deleted) {
        if (new Headers(init?.headers).get('Accept') === 'application/vnd.pgrst.object+json') {
          status = 406;
          body = { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' };
        } else body = [];
      } else if (new Headers(init?.headers).get('Accept') === 'application/vnd.pgrst.object+json') body = { id: 'parent-topic' };
      statuses.push(status);
      return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  jest.mocked(getSupabaseClient).mockReturnValue(client);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(queryClient, { queryKey: ['topics', 'parent-topic'], queryFn: () => topicsApi.getTopic('parent-topic') });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch();
    expect(observer.getCurrentResult().data?.id).toBe('parent-topic');
    await topicsApi.deleteTopic('parent-topic');
    await queryClient.invalidateQueries({ queryKey: ['topics'] });
    expect(observer.getCurrentResult()).toMatchObject({ status: 'success', data: null });
    expect(statuses).toEqual([200, 204, 200]);
  } finally { unsubscribe(); queryClient.clear(); }
});
