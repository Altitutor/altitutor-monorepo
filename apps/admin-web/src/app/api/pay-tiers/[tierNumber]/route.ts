import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import type { TablesUpdate } from '@altitutor/shared';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const tierNumber = Number(params.tierNumber);
  if (!Number.isFinite(tierNumber)) {
    return NextResponse.json({ error: 'Invalid tier number' }, { status: 400 });
  }
  try {
    const body = (await request.json()) as {
      name?: string | null;
      base_pay_rate_cents?: number;
      currency?: string;
    };
    const updates: TablesUpdate<'staff_pay_tiers'> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.base_pay_rate_cents !== undefined) updates.base_pay_rate_cents = body.base_pay_rate_cents;
    if (body.currency !== undefined) updates.currency = body.currency;

    const { data, error } = await auth.admin
      .from('staff_pay_tiers')
      .update(updates)
      .eq('tier_number', tierNumber)
      .select()
      .single();
    if (error) return captureApiErrorResponse(error, "/api/pay-tiers/[tierNumber]", NextResponse.json({ error: error.message }, { status: 500 }));
    return NextResponse.json({ tier: data });
  } catch (e) {
    captureApiError(e, "/api/pay-tiers/[tierNumber]");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update tier' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const tierNumber = Number(params.tierNumber);
  if (!Number.isFinite(tierNumber)) {
    return NextResponse.json({ error: 'Invalid tier number' }, { status: 400 });
  }
  const { count } = await auth.admin
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('current_tier_number', tierNumber);
  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Cannot delete tier while staff are assigned to it' },
      { status: 400 }
    );
  }
  const { error } = await auth.admin.from('staff_pay_tiers').delete().eq('tier_number', tierNumber);
  if (error) return captureApiErrorResponse(error, "/api/pay-tiers/[tierNumber]", NextResponse.json({ error: error.message }, { status: 500 }));
  return NextResponse.json({ success: true });
}
