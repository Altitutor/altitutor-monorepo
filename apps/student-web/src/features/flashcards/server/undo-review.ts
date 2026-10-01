import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFlashcardClient } from '@/features/flashcards/server/user-client';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json() as { requestId?: unknown; answerLogId?: unknown };
  if (
    typeof body.requestId !== 'string'
    || typeof body.answerLogId !== 'string'
    || !uuidPattern.test(body.requestId)
    || !uuidPattern.test(body.answerLogId)
  ) {
    return NextResponse.json({ error: 'Invalid undo command' }, { status: 400 });
  }

  const user = await authenticatedFlashcardClient(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: studentId } = await user.rpc('current_student_id');
  if (!studentId) return NextResponse.json({ error: 'student_not_found' }, { status: 403 });

  const { data, error } = await getServerSupabaseAdmin({ retry: false }).rpc('undo_flashcard_answer', {
    p_student_id: studentId,
    p_answer_log_id: body.answerLogId,
    p_request_id: body.requestId,
    p_request_fingerprint: `undo:${body.answerLogId}`,
  });
  if (error) {
    const status = error.code === 'PT409' || error.code === '40001' || error.code === '55P03'
      ? 409
      : error.code === '22023'
        ? 400
        : 500;
    const code = error.code === '55P03'
      ? 'flashcard_command_in_progress'
      : error.code === 'PT409' || error.code === '40001'
        ? 'flashcard_undo_conflict'
        : error.message;
    const response = NextResponse.json({ error: error.message, code }, { status });
    return status === 500
      ? captureApiErrorResponse(error, '/api/flashcards/review-cards/undo', response)
      : response;
  }
  return NextResponse.json({ data });
}
