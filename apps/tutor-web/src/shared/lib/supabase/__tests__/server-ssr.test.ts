/** @jest-environment node */

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createClient } from '../server-ssr';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/sentry/instrument-supabase-client', () => ({
  instrumentSupabaseClient: (client: unknown) => client,
}));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
});

it('uses the native caller credential without reading browser cookies', async () => {
  const request = new Request('https://tutor.example.com/api/tutor-logs', {
    headers: { Authorization: 'Bearer native-access-token' },
  });

  await createClient(request);

  expect(createSupabaseClient).toHaveBeenCalledWith(
    'https://example.supabase.co',
    'public-test-key',
    expect.objectContaining({
      auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      global: { headers: { Authorization: 'Bearer native-access-token' } },
    }),
  );
  expect(cookies).not.toHaveBeenCalled();
  expect(createServerClient).not.toHaveBeenCalled();
});

it('uses the established cookie client for a browser request', async () => {
  await createClient(new Request('https://tutor.example.com/api/tutor-logs'));

  expect(cookies).toHaveBeenCalledTimes(1);
  expect(createServerClient).toHaveBeenCalledTimes(1);
  expect(createSupabaseClient).not.toHaveBeenCalled();
});
