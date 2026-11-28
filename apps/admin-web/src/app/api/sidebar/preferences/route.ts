import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { defaultSidebarPreferences, normalizeSidebarPreferences, sidebarPreferencesSchema } from '@/features/sidebar/preferences';

const appKey = 'admin-web-sidebar';

async function authorize() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: active, error } = await db.rpc('is_adminstaff_active');
  if (error || !supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Sidebar preferences are unavailable.' }, { status: 500 }) };
  }
  if (!active) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { db: supabaseAdmin, userId: user.id };
}

export async function GET() {
  const access = await authorize();
  if (access.error) return access.error;
  const { data, error } = await access.db.from('user_interface_preferences')
    .select('preferences').eq('auth_user_id', access.userId).eq('app_key', appKey).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load sidebar preferences.' }, { status: 500 });
  const parsed = sidebarPreferencesSchema.safeParse(data?.preferences);
  return NextResponse.json(parsed.success ? normalizeSidebarPreferences(parsed.data) : defaultSidebarPreferences);
}

export async function PUT(request: Request) {
  const access = await authorize();
  if (access.error) return access.error;
  const parsed = sidebarPreferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sidebar preferences.' }, { status: 400 });
  const preferences = normalizeSidebarPreferences(parsed.data);
  const { error } = await access.db.from('user_interface_preferences').upsert({
    auth_user_id: access.userId,
    app_key: appKey,
    preferences,
  }, { onConflict: 'auth_user_id,app_key' });
  if (error) return NextResponse.json({ error: 'Could not save sidebar preferences.' }, { status: 500 });
  return NextResponse.json(preferences);
}
