import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { sessionsApi } from '../sessions';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const mockClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const activeConflict = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "uq_sessions_class_start_end"',
};

function updateClient(error: { code: string; message: string } | null, row?: Tables<'sessions'>) {
  return {
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: row ?? null, error }),
          }),
        }),
      }),
    }),
  };
}

describe('sessionsApi.updateSession class time conflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('explains when another active session already uses that class, start, and end', async () => {
    mockClient.mockReturnValue(updateClient(activeConflict) as unknown as ReturnType<typeof getSupabaseClient>);
    await expect(
      sessionsApi.updateSession('session-1', { start_at: '2031-03-05T07:15:00.000Z', end_at: '2031-03-05T08:45:00.000Z' }),
    ).rejects.toThrow('This class already has an active session at that start and end.');
  });

  it('preserves unrelated unique violations', async () => {
    const unrelated = { code: '23505', message: 'duplicate key value violates unique constraint "sessions_pkey"' };
    mockClient.mockReturnValue(updateClient(unrelated) as unknown as ReturnType<typeof getSupabaseClient>);
    await expect(sessionsApi.updateSession('session-1', { status: 'ACTIVE' })).rejects.toBe(unrelated);
  });
});
