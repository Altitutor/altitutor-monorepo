import type { NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { POST } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
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
  captureApiErrorResponse: jest.fn((_error: unknown, _path: string, response: unknown) => response),
}));

const mockedCreateClient = jest.mocked(createClient);
const mockedGetServerSupabaseAdmin = jest.mocked(getServerSupabaseAdmin);
const requestId = 'fa100000-0000-4000-8000-000000000009';
const answerLogId = 'fa100000-0000-4000-8000-000000000008';

function request(body: unknown): NextRequest {
  return { json: jest.fn().mockResolvedValue(body) } as unknown as NextRequest;
}

describe('POST /api/flashcards/review-cards/undo', () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateClient.mockReturnValue({
      auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'user-id' } } }) },
      rpc: jest.fn().mockResolvedValue({ data: 'student-id', error: null }),
    } as unknown as ReturnType<typeof createClient>);
    mockedGetServerSupabaseAdmin.mockReturnValue({ rpc } as unknown as ReturnType<typeof getServerSupabaseAdmin>);
    rpc.mockResolvedValue({ data: { undoneReviewLogId: answerLogId }, error: null });
  });

  it('undoes the exact immutable answer receipt', async () => {
    const response = await POST(request({ requestId, answerLogId }));

    expect(response.status).toBe(200);
    expect(mockedGetServerSupabaseAdmin).toHaveBeenCalledWith({ retry: false });
    expect(rpc).toHaveBeenCalledWith('undo_flashcard_answer', {
      p_student_id: 'student-id',
      p_answer_log_id: answerLogId,
      p_request_id: requestId,
      p_request_fingerprint: `undo:${answerLogId}`,
    });
  });

  it('rejects an undo without a valid answer receipt before querying the database', async () => {
    const response = await POST(request({ requestId }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns a retryable conflict when another command owns the student lock', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '55P03', message: 'flashcard_command_in_progress' },
    });

    const response = await POST(request({ requestId, answerLogId }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'flashcard_command_in_progress',
      code: 'flashcard_command_in_progress',
    });
  });

  it('distinguishes a stale card revision from transient lock contention', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'PT409', message: 'flashcard_undo_conflict' },
    });

    const response = await POST(request({ requestId, answerLogId }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'flashcard_undo_conflict',
      code: 'flashcard_undo_conflict',
    });
  });
});
