import { lessonDocumentsResponse } from '@altitutor/shared/teaching/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { teachingClient } from '@/features/teaching/server/auth';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    return await lessonDocumentsResponse(request, token ? teachingClient(token) : await createClient(), getServiceRoleClient(), 'tutor');
  } catch (error) {
    captureApiError(error, '/api/lesson-documents');
    return Response.json({ error: 'Lesson PDFs are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
