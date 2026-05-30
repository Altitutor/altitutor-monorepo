import { NextRequest, NextResponse } from 'next/server';
import { fetchStaffTierProgress } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(
  _request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  try {
    const progress = await fetchStaffTierProgress(auth.admin, params.staffId);
    return NextResponse.json({ progress });
  } catch (e) {
    console.error('GET pay-tiers/staff:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load progress' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as {
    employment_started_at?: string;
    metric_overrides?: Record<string, number>;
    current_tier_number?: number;
  };
  const updates: Record<string, unknown> = {};
  if (body.employment_started_at !== undefined) {
    updates.employment_started_at = body.employment_started_at;
  }
  if (body.metric_overrides !== undefined) {
    updates.metric_overrides = body.metric_overrides;
  }
  if (body.current_tier_number !== undefined) {
    updates.current_tier_number = body.current_tier_number;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  const { error } = await auth.admin.from('staff').update(updates).eq('id', params.staffId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const progress = await fetchStaffTierProgress(auth.admin, params.staffId);
    return NextResponse.json({ progress });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Updated but failed to reload progress' },
      { status: 500 }
    );
  }
}
