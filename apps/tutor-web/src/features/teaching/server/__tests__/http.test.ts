/** @jest-environment node */
import { handleTeachingRequest } from '../http';

let mockProfileErrors: Array<{code: string; message: string}> = [];

it('requires native credentials instead of falling back to a browser cookie', async () => {
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/profile', {
    headers: { Cookie: 'tutor-auth=someone-else' },
  }));
  expect(response.status).toBe(401);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options?: { global?: { headers?: { Authorization?: string } } }) => ({
    auth: { getUser: async () => ({
      data: { user: options?.global?.headers?.Authorization === 'Bearer tutor-token' ? { id: 'auth-tutor' } : null },
      error: options?.global?.headers?.Authorization === 'Bearer tutor-token' ? null : new Error('Invalid token'),
    }) },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: {
      id: 'staff-tutor', user_id: 'auth-tutor', first_name: 'Alex', last_name: 'Tutor', role: 'TUTOR', status: 'ACTIVE',
    }, error: mockProfileErrors.shift() ?? null }) }) }),
  }),
}));

beforeEach(() => {
  mockProfileErrors = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-public-key';
});

it('rejects a supplied token that the auth service cannot verify', async () => {
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/profile', {
    headers: { Authorization: 'Bearer forged-token' },
  }));
  expect(response.status).toBe(401);
});

it('returns the authenticated tutor profile without exposing staff contact data', async () => {
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/profile', {
    headers: { Authorization: 'Bearer tutor-token' },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'staff-tutor', userID: 'auth-tutor', name: 'Alex Tutor', canSubmitLogs: true });
});

it('recovers the documented JWT clock-skew profile failure without logging out the tutor', async () => {
  mockProfileErrors.push({code: 'PGRST303', message: 'JWT issued at future'});
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/profile', {
    headers: {Authorization: 'Bearer tutor-token'},
  }));
  expect(response.status).toBe(200);
});
