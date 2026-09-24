import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { startCodexDeviceFlow } from '@/features/ucat-generation-settings/server/codex-oauth';

export const dynamic = 'force-dynamic';

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

  return { ok: true as const, staffId: staff.id };
}

export async function POST() {
  const access = await requireAdminStaff();
  if (!access.ok) return access.response;

  try {
    const flow = await startCodexDeviceFlow();
    return NextResponse.json(flow);
  } catch (error) {
    captureApiError(error, "/api/ucat-generation/codex-oauth/start");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start Codex OAuth' },
      { status: 500 },
    );
  }
}
