/** @jest-environment node */

import { GET, PUT } from '../route';

const mockGetUser = jest.fn();
const mockStaffCheck = jest.fn();
const mockFilter = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, rpc: mockStaffCheck }),
}));

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => {
        const query = {
          eq: (...args: unknown[]) => {
            mockFilter(...args);
            return query;
          },
          maybeSingle: mockRead,
        };
        return query;
      },
      upsert: mockWrite,
    }),
  },
}));

function request(preferences: unknown) {
  return new Request('http://localhost/api/sidebar/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'signed-in-admin' } } });
  mockStaffCheck.mockResolvedValue({ data: true });
  mockRead.mockResolvedValue({ data: null });
  mockWrite.mockResolvedValue({ error: null });
});

test('reads the signed-in admin’s own sidebar preferences in their separate preference scope', async () => {
  mockRead.mockResolvedValue({
    data: { preferences: { order: ['/students', '/removed-page'], hidden: ['/reports'] } },
  });
  const response = await GET();
  expect(await response.json()).toEqual({ order: ['/students'], hidden: ['/reports'] });
  expect(mockFilter.mock.calls).toEqual([
    ['auth_user_id', 'signed-in-admin'],
    ['app_key', 'admin-web-sidebar'],
  ]);
});

test('writes only the caller’s sidebar preferences and ignores retired navigation items', async () => {
  const response = await PUT(request({
    order: ['/reports', '/students|/staff', '/retired'],
    hidden: ['/email'],
  }));
  expect(response.status).toBe(200);
  expect(mockWrite).toHaveBeenCalledWith({
    auth_user_id: 'signed-in-admin',
    app_key: 'admin-web-sidebar',
    preferences: { order: ['/reports', '/students|/staff'], hidden: ['/email'] },
  }, { onConflict: 'auth_user_id,app_key' });
});

test('rejects unsigned and inactive requests before reading or writing preferences', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await GET()).status).toBe(401);
  mockStaffCheck.mockResolvedValueOnce({ data: false });
  expect((await PUT(request({ order: [], hidden: [] }))).status).toBe(403);
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
});
