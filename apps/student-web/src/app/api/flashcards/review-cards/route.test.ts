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

function request(search = 'mode=due'): NextRequest {
  return { nextUrl: new URL(`https://student.altitutor.com/api/flashcards/review-cards?${search}`) } as NextRequest;
}

function reviewCard(index: number) {
  return {
    id: `card-${index}`,
    flashcard_id: `note-${index}`,
    cloze_index: 0,
    topic_id: 'topic-1',
    card_type: 'basic',
    cloze_text: 'cell',
    extra: null,
    image_file_id: null,
    image_alt_text: null,
    image_storage_path: null,
    image_mimetype: null,
    occlusion_data: null,
    flashcard_index: index,
    due_at: '2026-09-19T00:00:00Z',
    stability: null,
    difficulty: null,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_reviewed_at: null,
    last_rating: null,
    revision: 1,
    buried_until: null,
    buried_reason: null,
    suspended_at: null,
    leech_at: null,
  };
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
    const range = jest.fn().mockResolvedValue({ data: [], error: null });
    const thirdOrder = jest.fn(() => ({ range }));
    const secondOrder = jest.fn(() => ({ order: thirdOrder }));
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
    await expect(response.json()).resolves.toEqual({ data: { cards: [], counts: { new: 0, learning: 0, relearning: 0, review: 0, total: 0 }, held: { buried: 0, suspended: 0, newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 }, nextDueAt: null, timezone: 'Australia/Adelaide', timezoneConfirmationRequired: true, catalogTotal: 0, subjects: [] } });
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('vstudent_flashcard_review_cards');
    expect(getClaims.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
    expect(response.headers).toEqual({ 'Cache-Control': 'private, no-store' });
  });

  it('returns only the due total when countsOnly is set and there are no cards', async () => {
    mockedCreateClient.mockReturnValue({
      auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'student-user-id' } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        })),
      })),
      rpc: jest.fn().mockResolvedValue({ data: 'student-id', error: null }),
    } as unknown as ReturnType<typeof createClient>);
    const adminFrom = jest.fn((table: string) => {
      if (table === 'student_flashcard_preferences') {
        return { select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })) })) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    mockedGetServerSupabaseAdmin.mockReturnValue({
      from: adminFrom,
      rpc: jest.fn().mockResolvedValue({ data: [{ starts_at: '2026-09-18T18:30:00Z', ends_at: '2026-09-19T18:30:00Z' }], error: null }),
    } as unknown as ReturnType<typeof getServerSupabaseAdmin>);

    const response = await GET(request('mode=due&countsOnly=1'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { total: 0 } });
    expect(adminFrom).not.toHaveBeenCalledWith('flashcard_study_preset_versions');
  });

  it('counts review cards past the 1000-row API page', async () => {
    const pages = [
      Array.from({ length: 1000 }, (_, index) => reviewCard(index)),
      [reviewCard(1000)],
    ];
    const range = jest.fn().mockImplementation((from: number) => Promise.resolve({ data: pages[from / 1000] ?? [], error: null }));
    mockedCreateClient.mockReturnValue({
      auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'student-user-id' } }, error: null }) },
      from: jest.fn((table: string) => {
        if (table === 'vstudent_topics_files') {
          return { select: jest.fn(() => ({ in: jest.fn(() => ({ eq: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })) })) })) };
        }
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => ({
                order: jest.fn(() => ({ range })),
              })),
            })),
          })),
        };
      }),
      rpc: jest.fn().mockResolvedValue({ data: 'student-id', error: null }),
    } as unknown as ReturnType<typeof createClient>);
    const adminFrom = jest.fn((table: string) => {
      if (table === 'student_flashcard_preferences') {
        return { select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })) })) };
      }
      if (table === 'subject_flashcard_study_presets') {
        return { select: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [], error: null }) })) };
      }
      if (table === 'topics') {
        return { select: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [{ id: 'topic-1', subject_id: 'subject-1', code: 'BIO', name: 'Cells' }], error: null }) })) };
      }
      if (table === 'subjects') {
        return { select: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [{ id: 'subject-1', short_name: '12BIOL', name: 'Biology', long_name: 'SACE 12 Biology' }], error: null }) })) };
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
        return { select: jest.fn(() => ({ eq: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [], error: null }) })) })) };
      }
      return { select: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn(() => ({ is: jest.fn(() => ({ gte: jest.fn(() => ({ lt: jest.fn().mockResolvedValue({ data: [], error: null }) })) })) })) })) })) };
    });
    mockedGetServerSupabaseAdmin.mockReturnValue({
      storage: { from: jest.fn() },
      from: adminFrom,
      rpc: jest.fn().mockResolvedValue({ data: [{ starts_at: '2026-09-18T18:30:00Z', ends_at: '2026-09-19T18:30:00Z', study_day: '2026-09-19' }], error: null }),
    } as unknown as ReturnType<typeof getServerSupabaseAdmin>);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(body.data.catalogTotal).toBe(1001);
    expect(body.data.subjects).toEqual([expect.objectContaining({ name: 'SACE 12 Biology', total: 1001 })]);
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
