/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/service-role', () => ({
  getServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/sentry/capture-api-error', () => ({
  captureApiError: jest.fn(),
}));

function resolvedQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    order: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('GET /api/session-files', () => {
  it('signs all stored files in one batch and preserves response order', async () => {
    jest.mocked(createClient).mockReturnValue({
      rpc: jest.fn()
        .mockResolvedValueOnce({ data: true })
        .mockResolvedValueOnce({ data: 'tutor-id' }),
    } as never);

    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: 'sessions/one.pdf', signedUrl: 'https://signed/one' },
        { path: 'sessions/two.pdf', signedUrl: 'https://signed/two' },
      ],
      error: null,
    });
    const service = {
      from: jest.fn((table: string) => {
        if (table === 'sessions_staff') {
          return resolvedQuery({ data: { session_id: 'session-id' }, error: null });
        }
        return resolvedQuery({
          data: [
            { id: 'link-1', file: { storage_path: 'sessions/one.pdf' } },
            { id: 'link-2', file: { storage_path: null } },
            { id: 'link-3', file: { storage_path: 'sessions/two.pdf' } },
          ],
          error: null,
        });
      }),
      storage: {
        from: jest.fn(() => ({ createSignedUrls })),
      },
    };
    jest.mocked(getServiceRoleClient).mockReturnValue(service as never);

    const response = await GET(
      new NextRequest('http://localhost/api/session-files?sessionId=session-id'),
    );

    expect(response.status).toBe(200);
    expect(createSignedUrls).toHaveBeenCalledWith(
      ['sessions/one.pdf', 'sessions/two.pdf'],
      3600,
    );
    await expect(response.json()).resolves.toEqual([
      { id: 'link-1', file: { storage_path: 'sessions/one.pdf' }, signedUrl: 'https://signed/one' },
      { id: 'link-2', file: { storage_path: null }, signedUrl: null },
      { id: 'link-3', file: { storage_path: 'sessions/two.pdf' }, signedUrl: 'https://signed/two' },
    ]);
  });
});
