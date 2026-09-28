import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

import { authenticatedFlashcardClient } from './user-client';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/sentry/instrument-supabase-client', () => ({ instrumentSupabaseClient: (client: unknown) => client }));

const mockedCreateClient = jest.mocked(createClient);
const mockedCreateServerClient = jest.mocked(createServerClient);

function request(authorization: string | null = null): Request {
  return {
    headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? authorization : null },
  } as Request;
}

describe('authenticatedFlashcardClient', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });

  it('uses a verified cookie session for web requests', async () => {
    const client = {
      auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'web-user' } }, error: null }) },
    };
    mockedCreateServerClient.mockReturnValue(client as unknown as ReturnType<typeof createServerClient>);

    expect(await authenticatedFlashcardClient(request())).toBe(client);
    expect(client.auth.getClaims).toHaveBeenCalledTimes(1);
    expect(mockedCreateServerClient).toHaveBeenCalledWith({ fetch: expect.any(Function) });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('validates a bearer caller and uses that identity even when cookies exist', async () => {
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'native-user', is_anonymous: false } }, error: null }) },
    };
    mockedCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    expect(await authenticatedFlashcardClient(request('Bearer native-token'))).toBe(client);
    expect(client.auth.getUser).toHaveBeenCalledWith('native-token');
    expect(mockedCreateServerClient).not.toHaveBeenCalled();
    expect(mockedCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'public-key', expect.objectContaining({
      global: expect.objectContaining({ headers: { Authorization: 'Bearer native-token' }, fetch: expect.any(Function) }),
    }));
  });

  it('rejects malformed or unverified bearer credentials without cookie fallback', async () => {
    expect(await authenticatedFlashcardClient(request('Basic wrong'))).toBeNull();

    mockedCreateClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('expired') }) },
    } as unknown as ReturnType<typeof createClient>);
    expect(await authenticatedFlashcardClient(request('Bearer expired-token'))).toBeNull();
    expect(mockedCreateServerClient).not.toHaveBeenCalled();
  });
});
