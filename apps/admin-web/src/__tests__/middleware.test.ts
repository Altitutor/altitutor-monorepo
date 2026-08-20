/** @jest-environment node */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { middleware } from '../middleware';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

type ClaimsResult = {
  data: { claims: { sub?: string } | null } | null;
  error: { name: string; message: string } | null;
};

type StaffResult = {
  data: {
    id: string;
    role: 'ADMINSTAFF' | 'TUTOR';
    status: 'ACTIVE' | 'INACTIVE';
  } | null;
  error: { message: string } | null;
};

const mockCreateServerClient = jest.mocked(createServerClient);
const mockGetClaims = jest.fn<Promise<ClaimsResult>, []>();
const mockTutorMaybeSingle = jest.fn<Promise<StaffResult>, []>();
const mockTutorSelect = jest.fn(() => ({ maybeSingle: mockTutorMaybeSingle }));
const mockFrom = jest.fn(() => ({ select: mockTutorSelect }));
const mockRpc = jest.fn();
let consoleError: jest.SpyInstance;

function request(pathname: string) {
  return new NextRequest(`https://admin.altitutor.test${pathname}`);
}

function authenticatedClaims(): ClaimsResult {
  return {
    data: { claims: { sub: 'user-1' } },
    error: null,
  };
}

describe('admin middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.altitutor.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockGetClaims.mockResolvedValue(authenticatedClaims());
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockTutorMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
      rpc: mockRpc,
    } as never);
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each(['/login', '/forgot-password', '/api/staff']) (
    'does not contact Supabase for public path %s',
    async (pathname) => {
      const response = await middleware(request(pathname));

      expect(response.status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    }
  );

  it('redirects an anonymous protected request to login', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://admin.altitutor.test/login');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('allows an active admin through', async () => {
    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(mockRpc).toHaveBeenCalledWith('is_adminstaff_active');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('redirects an active tutor to tutor-web', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockTutorMaybeSingle.mockResolvedValue({
      data: { id: 'staff-1', role: 'TUTOR', status: 'ACTIVE' },
      error: null,
    });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3002/');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('vtutor_profile');
  });

  it.each([
    null,
    { id: 'staff-1', role: 'ADMINSTAFF' as const, status: 'INACTIVE' as const },
  ])('denies a missing or inactive staff record', async (staff) => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockTutorMaybeSingle.mockResolvedValue({ data: staff, error: null });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://admin.altitutor.test/login?error=access_denied'
    );
  });

  it('returns a retryable 503 when auth is unavailable', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: 'AuthUnknownError', message: 'upstream returned HTML' },
    });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('returns a retryable 503 when the admin-role lookup is unavailable', async () => {
    mockRpc.mockResolvedValue({
      data: false,
      error: { message: 'upstream timed out' },
    });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
  });

  it('returns a retryable 503 when the tutor profile lookup is unavailable', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockTutorMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'upstream timed out' },
    });

    const response = await middleware(request('/dashboard'));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
  });

  it('preserves cookies rotated during authentication on redirects', async () => {
    mockGetClaims.mockImplementation(async () => {
      const options = mockCreateServerClient.mock.calls[0]?.[2];
      options?.cookies?.setAll?.([
        {
          name: 'admin-auth',
          value: 'rotated-session',
          options: { path: '/', httpOnly: true, maxAge: 3_600 },
        },
      ]);
      return authenticatedClaims();
    });

    const response = await middleware(request('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://admin.altitutor.test/dashboard');
    expect(response.headers.get('set-cookie')).toContain('admin-auth=rotated-session');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=3600');
  });

  it('bounds the entire middleware invocation to ten seconds', async () => {
    jest.useFakeTimers();
    mockGetClaims.mockReturnValue(new Promise(() => undefined));

    try {
      const responsePromise = middleware(request('/dashboard'));
      jest.advanceTimersByTime(10_000);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    } finally {
      jest.useRealTimers();
    }
  });
});
