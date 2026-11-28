/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../route';

const mockGetUser = jest.fn();
const mockStaff = jest.fn();
const mockStaffFilter = jest.fn();
const mockInvoke = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('@/features/messages/api/systemTemplates', () => ({
  getStudentInviteMessage: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    functions: { invoke: mockInvoke },
    from: (table: string) => {
      if (table === 'staff') {
        const query = {
          eq: (...filters: unknown[]) => {
            mockStaffFilter(...filters);
            return query;
          },
          single: mockStaff,
        };
        return { select: () => query };
      }
      if (table === 'students') {
        return { select: () => ({
          eq: () => ({
            single: async () => ({ data: {
              id: 'student-1',
              first_name: 'Student',
              last_name: 'Fixture',
              phone: '+61400000001',
              invite_token: 'fixture-token',
            } }),
          }),
        }) };
      }
      throw new Error(`Unexpected authenticated table: ${table}`);
    },
  }),
}));

jest.mock('@/shared/lib/supabase/server/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'contacts') {
        return { select: () => ({ eq: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: { id: 'contact-1' } }),
        }) }) }) };
      }
      if (table === 'owned_numbers') {
        return { select: () => ({ eq: () => ({
          single: async () => ({ data: { id: 'sender-1', phone_e164: '+61400000002' } }),
        }) }) };
      }
      if (table === 'conversations') {
        const query = {
          eq: () => query,
          maybeSingle: async () => ({ data: { id: 'conversation-1' } }),
          single: async () => ({ data: {
            owned_number: { phone_e164: '+61400000002' },
            contact: { phone_e164: '+61400000001' },
          } }),
        };
        return { select: () => query };
      }
      if (table === 'messages') {
        return { insert: (message: unknown) => {
          mockInsert(message);
          return { select: () => ({
            single: async () => ({ data: { id: 'message-1' } }),
          }) };
        } };
      }
      throw new Error(`Unexpected server table: ${table}`);
    },
  },
}));

function request() {
  return new NextRequest('http://localhost/api/invites/send-sms', {
    method: 'POST',
    body: JSON.stringify({
      type: 'student',
      id: 'student-1',
      token: 'fixture-token',
      ownedNumberId: 'sender-1',
      customMessage: 'Test invite',
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
  mockStaff.mockResolvedValue({ data: { role: 'ADMINSTAFF' }, error: null });
  mockInvoke.mockResolvedValue({ error: null });
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Send not authorized' }, { status: 403 }));
});

afterEach(() => jest.restoreAllMocks());

it('dispatches a queued invite through the active AdminStaff session', async () => {
  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(mockStaffFilter).toHaveBeenCalledWith('status', 'ACTIVE');
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'QUEUED', body: 'Test invite' }));
  expect(mockInvoke).toHaveBeenCalledWith('send-message', { body: { messageId: 'message-1' } });
});

it('does not queue or dispatch an invite for a non-admin staff member', async () => {
  mockStaff.mockResolvedValue({ data: { role: 'TUTOR' }, error: null });

  const response = await POST(request());

  expect(response.status).toBe(403);
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockInvoke).not.toHaveBeenCalled();
});
