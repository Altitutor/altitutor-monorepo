import { NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { TeachingError } from '@/features/teaching/server/auth';
import {
  readTeachingBody,
  requireUUID,
} from '@/features/teaching/server/validation';
import {
  readSessionLessonPlan,
  saveSessionLessonPlan,
} from '@/features/sessions/server/lesson-plans';

type Context = { params: Promise<{ sessionId: string }> };
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
async function caller() {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) {
    if ((auth.error?.status ?? 0) >= 500)
      throw new TeachingError(
        503,
        'Sign-in verification is unavailable.',
        auth.error,
      );
    throw new TeachingError(401, 'Please sign in.');
  }
  const profile = await client
    .from('vtutor_profile')
    .select('id,user_id,role,status')
    .maybeSingle();
  if (profile.error)
    throw new TeachingError(503, 'Tutor access is unavailable.', profile.error);
  if (
    !profile.data?.id ||
    profile.data.user_id !== auth.data.user.id ||
    !['TUTOR', 'ADMINSTAFF'].includes(profile.data.role ?? '') ||
    !['ACTIVE', 'TRIAL'].includes(profile.data.status ?? '')
  ) {
    throw new TeachingError(403, 'Tutor access is required.');
  }
  return { client, profile: profile.data };
}
function failure(error: unknown) {
  if (!(error instanceof TeachingError) || error.status >= 500)
    captureApiError(
      error instanceof TeachingError ? (error.dependency ?? error) : error,
      '/api/sessions/[sessionId]/plan',
    );
  return json(
    {
      error:
        error instanceof TeachingError
          ? error.message
          : 'Lesson planning is temporarily unavailable.',
    },
    error instanceof TeachingError ? error.status : 503,
  );
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const sessionID = requireUUID((await context.params).sessionId);
    const { client } = await caller();
    return json(await readSessionLessonPlan(client, sessionID));
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: NextRequest, context: Context) {
  try {
    const sessionID = requireUUID((await context.params).sessionId);
    const { client, profile } = await caller();
    if (profile.status !== 'ACTIVE')
      throw new TeachingError(
        403,
        'Only active tutors may change a lesson plan.',
      );
    return json(
      await saveSessionLessonPlan(
        client,
        getServiceRoleClient(),
        profile.id!,
        sessionID,
        await readTeachingBody(request),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
