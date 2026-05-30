import { NextRequest, NextResponse } from 'next/server';
import { fetchStaffTierProgress } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

type PromotionOutcome = 'approved' | 'deferred' | 'not_ready';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { staffId: string; promotionId: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    outcome?: PromotionOutcome;
    notes?: string | null;
  };

  if (!body.outcome) {
    return NextResponse.json({ error: 'outcome is required' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await auth.admin
    .from('staff_tier_promotions')
    .select('id, staff_id, from_tier_number, to_tier_number, outcome, check_in_session_id')
    .eq('id', params.promotionId)
    .eq('staff_id', params.staffId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Promotion review not found' }, { status: 404 });
  }

  const { data: staff, error: staffError } = await auth.admin
    .from('staff')
    .select('id, current_tier_number')
    .eq('id', params.staffId)
    .single();
  if (staffError || !staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const nextTierNumber = existing.from_tier_number + 1;
  if (body.outcome === 'approved') {
    const { data: nextTier } = await auth.admin
      .from('staff_pay_tiers')
      .select('tier_number')
      .eq('tier_number', nextTierNumber)
      .maybeSingle();
    if (!nextTier) {
      return NextResponse.json({ error: 'No higher tier exists' }, { status: 400 });
    }
  }

  const newToTier =
    body.outcome === 'approved' ? nextTierNumber : existing.from_tier_number;
  const wasApproved = existing.outcome === 'approved';
  const isApproved = body.outcome === 'approved';

  const { error: updatePromoError } = await auth.admin
    .from('staff_tier_promotions')
    .update({
      outcome: body.outcome,
      notes: body.notes ?? null,
      to_tier_number: newToTier,
    })
    .eq('id', params.promotionId);
  if (updatePromoError) {
    return NextResponse.json({ error: updatePromoError.message }, { status: 500 });
  }

  let newStaffTier = staff.current_tier_number;
  if (wasApproved && !isApproved && staff.current_tier_number === existing.to_tier_number) {
    newStaffTier = existing.from_tier_number;
  } else if (!wasApproved && isApproved) {
    newStaffTier = Math.max(staff.current_tier_number, nextTierNumber);
  } else if (isApproved && staff.current_tier_number < nextTierNumber) {
    newStaffTier = nextTierNumber;
  }

  if (newStaffTier !== staff.current_tier_number) {
    const { error: tierError } = await auth.admin
      .from('staff')
      .update({ current_tier_number: newStaffTier })
      .eq('id', params.staffId);
    if (tierError) {
      return NextResponse.json({ error: tierError.message }, { status: 500 });
    }
  }

  try {
    const progress = await fetchStaffTierProgress(auth.admin, params.staffId);
    return NextResponse.json({
      progress,
      quickbooksReminder:
        !wasApproved && isApproved
          ? 'Update this employee’s pay rate in QuickBooks to match the new tier.'
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Review updated but failed to reload' },
      { status: 500 }
    );
  }
}
