import { createFlashcardBearerClient } from './user-client';

jest.mock('@/lib/sentry/instrument-supabase-client', () => ({
  instrumentSupabaseClient: <T>(client: T): T => client,
}));

describe('flashcard bearer client reads', () => {
  it('gets the new revision when the same study view is read after a rating', async () => {
    const cached = new Map<string, string>();
    let revision = 5;
    const calls: Array<{ cache?: RequestCache }> = [];
    const fetcher = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ cache: init?.cache });
      const fresh = JSON.stringify([{ id: 'review-card', revision }]);
      const body = init?.cache === 'no-store' ? fresh : cached.get(url) ?? fresh;
      if (init?.cache !== 'no-store') cached.set(url, body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => JSON.parse(body) as unknown,
        text: async () => body,
      } as Response;
    }) as typeof fetch;

    const client = createFlashcardBearerClient('https://example.supabase.co', 'anon-key', 'student-token', fetcher);
    const read = async () => {
      const { data, error } = await client.from('vstudent_flashcard_review_cards').select('id,revision');
      expect(error).toBeNull();
      return data?.[0]?.revision;
    };

    expect(await read()).toBe(5);
    revision = 6;
    expect(await read()).toBe(6);
    expect(calls).toEqual([{ cache: 'no-store' }, { cache: 'no-store' }]);
  });
});
