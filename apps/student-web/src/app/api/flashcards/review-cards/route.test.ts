import type { NextRequest } from 'next/server';
import { GET } from './route';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { DEFAULT_FLASHCARD_STUDY_PRESET } from '@/features/flashcards/server/fsrs';
import { DEFAULT_FLASHCARD_STUDY_PRESET_ID } from '@altitutor/shared';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers,
      json: async () => body,
    }),
  },
}));

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/server', () => ({
  getServerSupabaseAdmin: jest.fn(),
}));

jest.mock('@/lib/sentry/capture-api-error', () => ({
  captureApiErrorResponse: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);
const mockedGetServerSupabaseAdmin = jest.mocked(getServerSupabaseAdmin);

function request(): NextRequest {
  return { nextUrl: new URL('https://student.altitutor.com/api/flashcards/review-cards?mode=due') } as NextRequest;
}

describe('GET /api/flashcards/review-cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the cookie session before querying the student-scoped view', async () => {
    const getClaims = jest.fn().mockResolvedValue({
      data: { claims: { sub: 'student-user-id' } },
      error: null,
    });
    const resolvedQuery = Promise.resolve({ data: [], error: null });
    const secondOrder = jest.fn(() => resolvedQuery);
    const firstOrder = jest.fn(() => ({ order: secondOrder }));
    const select = jest.fn(() => ({ order: firstOrder }));
    const from = jest.fn(() => ({ select }));

    mockedCreateClient.mockReturnValue({
      auth: { getClaims },
      from,
      rpc: jest.fn().mockResolvedValue({ data: 'student-id', error: null }),
    } as unknown as ReturnType<typeof createClient>);
    const preferencesMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const preferencesEq = jest.fn(() => ({ maybeSingle: preferencesMaybeSingle }));
    const logsResult = Promise.resolve({ data: [], error: null });
    const logsLt = jest.fn(() => logsResult);
    const logsGte = jest.fn(() => ({ lt: logsLt }));
    const logsIs = jest.fn(() => ({ gte: logsGte }));
    const logsSecondEq = jest.fn(() => ({ is: logsIs }));
    const logsFirstEq = jest.fn(() => ({ eq: logsSecondEq }));
    const adminFrom = jest.fn((table: string) => {
      if (table === 'student_flashcard_preferences') {
        return { select: jest.fn(() => ({ eq: preferencesEq })) };
      }
      if (table === 'flashcard_study_preset_versions') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({ order: jest.fn().mockResolvedValue({
              data: [{
                preset_id: DEFAULT_FLASHCARD_STUDY_PRESET_ID,
                version: 1,
                desired_retention: DEFAULT_FLASHCARD_STUDY_PRESET.desiredRetention,
                learning_steps_minutes: DEFAULT_FLASHCARD_STUDY_PRESET.learningStepsMinutes,
                relearning_steps_minutes: DEFAULT_FLASHCARD_STUDY_PRESET.relearningStepsMinutes,
                minimum_lapse_interval_days: DEFAULT_FLASHCARD_STUDY_PRESET.minimumLapseIntervalDays,
                learn_ahead_minutes: 20,
                fsrs_parameters: DEFAULT_FLASHCARD_STUDY_PRESET.fsrsParameters,
              }],
              error: null,
            }) })),
          })),
        };
      }
      if (table === 'student_flashcard_preset_preferences') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [], error: null }) })),
          })),
        };
      }
      return { select: jest.fn(() => ({ eq: logsFirstEq })) };
    });
    mockedGetServerSupabaseAdmin.mockReturnValue({
      storage: { from: jest.fn() },
      from: adminFrom,
      rpc: jest.fn().mockResolvedValue({ data: [{ starts_at: '2026-09-18T18:30:00Z', ends_at: '2026-09-19T18:30:00Z' }], error: null }),
    } as unknown as ReturnType<typeof getServerSupabaseAdmin>);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { cards: [], counts: { new: 0, learning: 0, relearning: 0, review: 0, total: 0 }, held: { buried: 0, suspended: 0, newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 }, nextDueAt: null, timezone: 'Australia/Adelaide', timezoneConfirmationRequired: true } });
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('vstudent_flashcard_review_cards');
    expect(getClaims.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
    expect(response.headers).toEqual({ 'Cache-Control': 'private, no-store' });
  });

  it('rejects a missing session instead of silently returning zero cards', async () => {
    const from = jest.fn();
    mockedCreateClient.mockReturnValue({
      auth: {
        getClaims: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
      from,
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(from).not.toHaveBeenCalled();
  });
});
