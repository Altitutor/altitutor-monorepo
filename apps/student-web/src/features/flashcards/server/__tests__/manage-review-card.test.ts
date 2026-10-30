/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../manage-review-card';

const stateQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'review-1' }, error: null }),
  single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Temporary read failure' } }),
};
const adminQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { timezone: 'Australia/Adelaide' }, error: null }),
  single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Temporary read failure' } }),
};
jest.mock('../user-client', () => ({
  authenticatedFlashcardClient: async () => ({
    rpc: async () => ({ data: 'student-1', error: null }),
    from: () => stateQuery,
  }),
}));
jest.mock('@/shared/lib/supabase/server', () => ({
  getServerSupabaseAdmin: () => ({
    from: () => adminQuery,
    rpc: async (name: string) => ({ data: name === 'manage_flashcard_review_card'
      ? { revision: 1, reviewLogId: 'log-1', replayed: false }
      : [{ ends_at: '2026-10-30T00:00:00Z' }], error: null }),
  }),
}));

it('returns the committed receipt if the optional manager state/history reads fail', async () => {
  const request = new NextRequest('http://localhost/api/flashcards/review-cards/review-1/manage', {
    method: 'POST',
    body: JSON.stringify({ action: 'forget', requestId: 'request-1' }),
  });
  const response = await POST(request, { params: Promise.resolve({ id: 'review-1' }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { revision: 1, reviewLogId: 'log-1', replayed: false } });
});
