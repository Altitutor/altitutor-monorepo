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

const staffFixture = {
  id: '10000000-0000-4000-8000-000000000001',
  first_name: 'E,',
  last_name: 'Tutor',
  role: 'TUTOR',
  status: 'ACTIVE',
  email: 'fixture@invalid.test',
  phone_number: null,
};

function createStaffQuery() {
  const query = {
    select: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    or: jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST100',
        message: 'failed to parse logic tree',
      },
    }),
    ilike: jest.fn().mockResolvedValue({ data: [staffFixture], error: null }),
  };

  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('GET /api/staff/search', () => {
  it('treats PostgREST grammar characters as literal staff search text', async () => {
    jest.mocked(createClient).mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    } as never);

    jest.mocked(getServiceRoleClient).mockReturnValue({
      from: jest.fn(() => createStaffQuery()),
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/staff/search?search=e%2C'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ staff: [staffFixture] });
  });
});
