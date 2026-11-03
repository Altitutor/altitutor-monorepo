import { lessonDocumentsResponse } from '@altitutor/shared/teaching/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { createNotificationUserClient as createLessonUserClient } from '@/features/notifications/server/user-client';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    return await lessonDocumentsResponse(request, await createLessonUserClient(request), getServerSupabaseAdmin(), 'student');
  } catch (error) {
    captureApiError(error, '/api/lesson-documents');
    return Response.json({ error: 'Lesson PDFs are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
