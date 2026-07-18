import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export const dynamic = 'force-dynamic';

type SupabaseAny = NonNullable<typeof supabaseAdmin> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

async function requireAdminStaff() {
  const userClient = createClient();
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: staff, error: staffError } = await userClient
    .from('staff')
    .select('id, role, status')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; role: string | null; status: string | null }>();

  if (staffError) {
    return { ok: false as const, response: NextResponse.json({ error: 'Failed to verify admin access' }, { status: 500 }) };
  }

  if (!staff || staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET() {
  const access = await requireAdminStaff();
  if (!access.ok) return access.response;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data, error } = await (supabaseAdmin as SupabaseAny)
    .from('ucat_ai_generation_oauth_accounts')
    .select('id,provider_id,label,account_id,expires_at,status,last_error,updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    captureApiError(error, "/api/ucat-generation/codex-oauth/accounts");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}
