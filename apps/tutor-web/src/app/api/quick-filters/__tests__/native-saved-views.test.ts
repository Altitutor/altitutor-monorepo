/** @jest-environment node */
import { encodeViewConfig, tutorDefaultDisplaySettings } from '@altitutor/shared';
import { NextRequest } from 'next/server';

import { DELETE, PATCH } from '../[id]/route';
import { POST } from '../route';

const userId = '22400000-0000-4000-8000-000000000001';
const viewId = '22400000-0000-4000-8000-000000000002';
const target = 'tutor:past_sessions';

const mockFromView = jest.fn();
const mockFromService = jest.fn();
const mockFilters = jest.fn();
const mockDelete = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockWriteSingle = jest.fn();
const mockExisting = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: (request: Request) => {
    mockAuth(request.headers.get('authorization'));
    return {
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
      rpc: async () => ({ data: true, error: null }),
      from: mockFromView,
    };
  },
}));
jest.mock('@/shared/lib/supabase/service-role', () => ({
  getServiceRoleClient: () => ({ from: mockFromService }),
}));

const config = encodeViewConfig(tutorDefaultDisplaySettings([], { filters: { type: ['CLASS'] } }));
const body = { name: 'Teaching', user_id: userId, target_entity: target, config };
const context = { params: Promise.resolve({ id: viewId }) };

function request(method: 'POST' | 'PATCH' | 'DELETE', nextBody: unknown = body) {
  return new NextRequest(`http://localhost/api/quick-filters/${method === 'POST' ? '' : viewId}`, {
    method,
    headers: { Authorization: 'Bearer test-token' },
    body: method === 'DELETE' ? undefined : JSON.stringify(nextBody),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  const view = {
    select: () => view,
    eq: () => view,
    maybeSingle: mockExisting,
  };
  mockFromView.mockReturnValue(view);
  const write = {
    eq: (key: string, value: string) => {
      mockFilters(key, value);
      return write;
    },
    select: () => write,
    single: mockWriteSingle,
  };
  mockDelete.mockReturnValue(write);
  mockUpdate.mockReturnValue(write);
  mockInsert.mockReturnValue(write);
  mockFromService.mockReturnValue({ delete: mockDelete, update: mockUpdate, insert: mockInsert });
  mockWriteSingle.mockResolvedValue({
    data: { ...body, id: viewId, created_at: '2026-11-06', updated_at: '2026-11-06' },
    error: null,
  });
  mockExisting.mockResolvedValue({ data: { user_id: userId, target_entity: target }, error: null });
});

it('creates a personal past-session view using the native caller identity', async () => {
  const response = await POST(request('POST'));
  expect(response?.status).toBe(200);
  expect(mockAuth).toHaveBeenCalledWith('Bearer test-token');
  expect(mockInsert).toHaveBeenCalledWith(body);
});

it.each([
  { ...body, user_id: '22400000-0000-4000-8000-000000000003' },
  { ...body, user_id: null },
  { ...body, target_entity: 'tutor:students' },
])('rejects native creation outside the caller’s personal history views', async (input) => {
  expect((await POST(request('POST', input)))?.status).toBe(403);
  expect(mockInsert).not.toHaveBeenCalled();
});

it('scopes native update to the same owner and target at write time', async () => {
  expect((await PATCH(request('PATCH'), context))?.status).toBe(200);
  expect(mockFromView).toHaveBeenCalledWith('vtutor_quick_filters');
  expect(mockFilters.mock.calls).toEqual([
    ['id', viewId], ['user_id', userId], ['target_entity', target],
  ]);
});

it('refuses to delete shared views, even when the caller can read them', async () => {
  mockExisting.mockResolvedValue({ data: { user_id: null, target_entity: target }, error: null });
  expect((await DELETE(request('DELETE'), context))?.status).toBe(404);
  expect(mockDelete).not.toHaveBeenCalled();
});
