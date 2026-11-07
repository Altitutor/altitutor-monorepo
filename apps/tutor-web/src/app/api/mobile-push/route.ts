import {
  defaultPushCategoryEnabled,
  isExpoPushToken,
  tutorPushCategory,
} from '@altitutor/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

const scope = 'staff_web';
const tokenSchema = z.custom<string>(isExpoPushToken);
const registration = z.object({
  token: tokenSchema,
  platform: z.enum(['ios', 'android']),
});
const preference = z.object({ category: z.literal(tutorPushCategory), enabled: z.boolean() });

const authSessionClaims = z.object({ sub: z.string(), session_id: z.guid() });
type PushUser = { userId: string; sessionId: string };
type UserClient = Awaited<ReturnType<typeof createClient>>;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function withUser(
  request: Request,
  handle: (user: PushUser, client: UserClient) => Promise<NextResponse>,
) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const client = await createClient(request);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error?.name === 'AuthRetryableFetchError' || (error?.status ?? 0) >= 500) {
      throw error;
    }
    if (error || !user) return json({ error: 'Unauthorized' }, 401);
    // Auth validated this exact JWT. Read its session identity, which is not in the user payload.
    const encodedClaims = token.split('.')[1];
    if (!encodedClaims) return json({ error: 'Unauthorized' }, 401);
    const claims = authSessionClaims.safeParse(JSON.parse(Buffer.from(encodedClaims, 'base64url').toString()));
    if (!claims.success || claims.data.sub !== user.id) return json({ error: 'Unauthorized' }, 401);
    return await handle({ userId: user.id, sessionId: claims.data.session_id }, client);
  } catch (error) {
    captureApiError(error, '/api/mobile-push');
    return json({ error: 'Unable to manage push notifications.' }, 503);
  }
}

function withTutor(
  request: Request,
  handle: (staffId: string, user: PushUser) => Promise<NextResponse>,
) {
  return withUser(request, async (user, client) => {
    const { data: staffId, error } = await client.rpc('current_tutor_id');
    if (error) throw error;
    if (!staffId) return json({ error: 'Tutor access required' }, 403);
    return handle(staffId, user);
  });
}

export function GET(request: Request) {
  return withTutor(request, async (staffId) => {
    const { data, error } = await getServiceRoleClient().from('mobile_push_preferences')
      .select('enabled')
      .eq('staff_id', staffId).eq('app_scope', scope).eq('category', tutorPushCategory)
      .maybeSingle();
    if (error) throw error;
    return json({
      categories: { [tutorPushCategory]: data?.enabled ?? defaultPushCategoryEnabled(tutorPushCategory) },
    });
  });
}

export function PATCH(request: Request) {
  return withTutor(request, async (staffId) => {
    const parsed = preference.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid notification preference.' }, 400);
    const { error } = await getServiceRoleClient().from('mobile_push_preferences').upsert({
      staff_id: staffId, app_scope: scope, ...parsed.data, updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_id,app_scope,category' });
    if (error) throw error;
    return json({ success: true });
  });
}

export function POST(request: Request) {
  return withTutor(request, async (staffId, { userId, sessionId }) => {
    const parsed = registration.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid push device.' }, 400);
    const { error } = await getServiceRoleClient().from('mobile_push_devices').upsert({
      staff_id: staffId,
      staff_user_id: userId,
      staff_session_id: sessionId,
      student_id: null,
      app_scope: scope,
      expo_push_token: parsed.data.token,
      platform: parsed.data.platform,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'expo_push_token' });
    if (error) throw error;
    return json({ success: true });
  });
}

export function DELETE(request: Request) {
  // Authenticated users can clear their own registration after losing tutor access.
  return withUser(request, async ({ userId, sessionId }) => {
    const parsed = z.object({ token: tokenSchema }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid push token.' }, 400);
    const { error } = await getServiceRoleClient().from('mobile_push_devices').delete()
      .eq('staff_user_id', userId).eq('staff_session_id', sessionId)
      .eq('app_scope', scope).eq('expo_push_token', parsed.data.token);
    if (error) throw error;
    return json({ success: true });
  });
}
