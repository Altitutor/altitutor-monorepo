import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { dashboardLayoutSchema, DEFAULT_DASHBOARD_LAYOUT } from '@/features/dashboard/layout';

const appKey = 'admin-web';

async function authorize() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: allowed, error } = await db.rpc('is_adminstaff_active');
  if (error || !supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Dashboard preferences are unavailable.' }, { status: 500 }) };
  }
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { db: supabaseAdmin, userId: user.id };
}

export async function GET() {
  const access = await authorize();
  if (access.error) return access.error;

  const { data, error } = await access.db.from('user_interface_preferences')
    .select('preferences').eq('auth_user_id', access.userId).eq('app_key', appKey).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load dashboard preferences.' }, { status: 500 });
  const layout = dashboardLayoutSchema.safeParse(
    typeof data?.preferences === 'object' && data.preferences && 'dashboardLayout' in data.preferences
      ? data.preferences.dashboardLayout : undefined,
  );
  return NextResponse.json({ layout: layout.success ? layout.data : DEFAULT_DASHBOARD_LAYOUT });
}

export async function PUT(request: Request) {
  const access = await authorize();
  if (access.error) return access.error;

  const layout = dashboardLayoutSchema.safeParse(await request.json().catch(() => null));
  if (!layout.success) return NextResponse.json({ error: 'Invalid dashboard layout.' }, { status: 400 });

  const { error } = await access.db.from('user_interface_preferences').upsert({
    auth_user_id: access.userId,
    app_key: appKey,
    preferences: { dashboardLayout: layout.data },
  }, { onConflict: 'auth_user_id,app_key' });
  if (error) return NextResponse.json({ error: 'Could not save dashboard preferences.' }, { status: 500 });
  return NextResponse.json({ layout: layout.data });
}
