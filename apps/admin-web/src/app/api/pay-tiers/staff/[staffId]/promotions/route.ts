import { NextRequest, NextResponse } from 'next/server';
import { fetchStaffTierProgress } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
type PromotionOutcome = 'approved' | 'deferred' | 'not_ready';

export async function POST(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    outcome?: PromotionOutcome;
    check_in_session_id?: string | null;
    notes?: string | null;
  };

  if (!body.outcome) {
    return NextResponse.json({ error: 'outcome is required' }, { status: 400 });
  }

  const { data: staff, error: staffError } = await auth.admin
    .from('staff')
    .select('id, current_tier_number')
    .eq('id', params.staffId)
    .single();
  if (staffError || !staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const fromTier = staff.current_tier_number;
  const toTier = fromTier + 1;

  if (body.outcome === 'approved') {
    const { data: nextTier } = await auth.admin
      .from('staff_pay_tiers')
      .select('tier_number')
      .eq('tier_number', toTier)
      .maybeSingle();
    if (!nextTier) {
      return NextResponse.json({ error: 'No higher tier exists' }, { status: 400 });
    }
  }

  if (body.check_in_session_id) {
    const { data: session } = await auth.admin
      .from('sessions')
      .select('id, type')
      .eq('id', body.check_in_session_id)
      .single();
    if (!session || session.type !== 'CHECK_IN') {
      return NextResponse.json({ error: 'check_in_session_id must be a CHECK_IN session' }, { status: 400 });
    }
  }

  const { error: promoError } = await auth.admin.from('staff_tier_promotions').insert({
    staff_id: params.staffId,
    from_tier_number: fromTier,
    to_tier_number: body.outcome === 'approved' ? toTier : fromTier,
    check_in_session_id: body.check_in_session_id ?? null,
    outcome: body.outcome,
    notes: body.notes ?? null,
    reviewed_by: auth.staffId,
  });
  if (promoError) {
    return NextResponse.json({ error: promoError.message }, { status: 500 });
  }

  if (body.outcome === 'approved') {
    const { error: updateError } = await auth.admin
      .from('staff')
      .update({ current_tier_number: toTier })
      .eq('id', params.staffId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  try {
    const progress = await fetchStaffTierProgress(auth.admin, params.staffId);
    return NextResponse.json({
      progress,
      quickbooksReminder:
        body.outcome === 'approved'
          ? 'Update this employee’s pay rate in QuickBooks to match the new tier.'
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Promotion recorded but failed to reload' },
      { status: 500 }
    );
  }
}
