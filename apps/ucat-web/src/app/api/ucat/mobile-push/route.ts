import {
  defaultPushCategoryEnabled,
  isExpoPushToken,
  isPushCategory,
  pushCategoriesFor,
  type PushCategory,
} from '@altitutor/shared';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const scope = 'ucat_web' as const;

async function context(request: Request) {
  const match = /^Bearer\s+(\S+)$/u.exec(request.headers.get('authorization') ?? '');
  if (!match) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!supabaseAdmin) throw new Error('Mobile push service is not configured.');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(match[1]);
  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const { data: student, error } = await supabaseAdmin.from('students')
    .select('id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!student) {
    return { response: NextResponse.json({ error: 'Student profile not found' }, { status: 404 }) } as const;
  }
  return { admin: supabaseAdmin, studentId: student.id } as const;
}

function failure(error: unknown) {
  console.error('[ucat mobile push] Request failed', error);
  return NextResponse.json({ error: 'Unable to update push notifications.' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const resolved = await context(request);
    if ('response' in resolved) return resolved.response;
    const { data, error } = await resolved.admin.from('mobile_push_preferences')
      .select('category, enabled').eq('student_id', resolved.studentId).eq('app_scope', scope);
    if (error) throw error;
    const overrides = new Map((data ?? []).map((row) => [row.category, row.enabled]));
    const categories = Object.fromEntries(
      pushCategoriesFor(scope).map((category) => [category, overrides.get(category) ?? defaultPushCategoryEnabled(category)]),
    ) as Record<PushCategory, boolean>;
    return NextResponse.json({ categories });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const resolved = await context(request);
    if ('response' in resolved) return resolved.response;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('category' in body) || !('enabled' in body)
        || !isPushCategory(scope, body.category) || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid category preference.' }, { status: 400 });
    }
    const { error } = await resolved.admin.from('mobile_push_preferences').upsert({
      student_id: resolved.studentId, app_scope: scope,
      category: body.category, enabled: body.enabled, updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,app_scope,category' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const resolved = await context(request);
    if ('response' in resolved) return resolved.response;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('token' in body) || !('platform' in body)
        || !isExpoPushToken(body.token) || (body.platform !== 'ios' && body.platform !== 'android')) {
      return NextResponse.json({ error: 'Invalid push device.' }, { status: 400 });
    }
    const { error } = await resolved.admin.from('mobile_push_devices').upsert({
      student_id: resolved.studentId, app_scope: scope,
      expo_push_token: body.token, platform: body.platform,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'expo_push_token' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const resolved = await context(request);
    if ('response' in resolved) return resolved.response;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('token' in body) || !isExpoPushToken(body.token)) {
      return NextResponse.json({ error: 'Invalid push token.' }, { status: 400 });
    }
    const { error } = await resolved.admin.from('mobile_push_devices').delete()
      .eq('student_id', resolved.studentId).eq('app_scope', scope).eq('expo_push_token', body.token);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
