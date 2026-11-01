/** @jest-environment node */
import { handleTeachingRequest } from '../http';

let mockStaffStatus = 'ACTIVE';
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
      id: 'staff-tutor', user_id: 'auth-tutor', first_name: 'Alex', last_name: 'Tutor', role: 'TUTOR', status: mockStaffStatus,
    }, error: mockProfileErrors.shift() ?? null }) }) }),
  }),
}));

beforeEach(() => {
  mockStaffStatus = 'ACTIVE';
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

// This directory is cached only by an already authenticated office device.
jest.mock('@/shared/lib/supabase/service-role', () => ({
  getServiceRoleClient: () => ({ from: () => {
    const query = {
      select: () => query, eq: () => query, in: () => query, is: () => query, not: () => query, order: () => query,
      range: async () => ({ data: [{ id: 'active-staff', first_name: 'Alex', last_name: 'Tutor', email: 'alex@example.test' }], error: null }),
    };
    return query;
  } }),
}));

it('lets an authenticated active staff member prepare the office login picker', async () => {
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/staff-directory', {
    headers: { Authorization: 'Bearer tutor-token' },
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual([{ id: 'active-staff', name: 'Alex Tutor', email: 'alex@example.test' }]);
});

it('does not expose the office login picker before staff authentication', async () => {
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/staff-directory'));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Sign in to the teaching app.' });
});

it('requires active staff for device setup even when a trial account has teaching access', async () => {
  mockStaffStatus = 'TRIAL';
  const response = await handleTeachingRequest(new Request('https://tutor.test/api/teaching/staff-directory', {
    headers: { Authorization: 'Bearer tutor-token' },
  }));
  expect(response.status).toBe(403);
});
