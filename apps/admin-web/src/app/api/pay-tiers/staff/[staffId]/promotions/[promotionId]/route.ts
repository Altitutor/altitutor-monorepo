import { NextRequest, NextResponse } from 'next/server';
import {
  getHighestEligiblePromotionTier,
  parseRequirementParams,
  validateApprovedPromotionTier,
  type StaffPayTierRequirement,
} from '@altitutor/shared/pay-tiers';
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
    to_tier_number?: number;
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

  const fromTier = existing.from_tier_number;

  const [tiersResult, requirementsResult, metricsResult] = await Promise.all([
    auth.admin.from('staff_pay_tiers').select('tier_number').order('tier_number', { ascending: true }),
    auth.admin
      .from('staff_pay_tier_requirements')
      .select('id, tier_number, requirement_kind, params, sort_order'),
    auth.admin.rpc('compute_staff_tier_metrics', { p_staff_id: params.staffId }),
  ]);

  if (tiersResult.error || requirementsResult.error || metricsResult.error) {
    return NextResponse.json({ error: 'Failed to load tier data' }, { status: 500 });
  }

  const maxTier =
    tiersResult.data?.length && tiersResult.data[tiersResult.data.length - 1]?.tier_number != null
      ? tiersResult.data[tiersResult.data.length - 1]!.tier_number
      : fromTier;

  const metrics: Record<string, number> = {};
  if (metricsResult.data && typeof metricsResult.data === 'object') {
    for (const [k, v] of Object.entries(metricsResult.data as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(n)) metrics[k] = n;
    }
  }

  const requirements: StaffPayTierRequirement[] = (requirementsResult.data ?? []).map((r) => ({
    id: r.id,
    tier_number: r.tier_number,
    requirement_kind: r.requirement_kind as StaffPayTierRequirement['requirement_kind'],
    params: parseRequirementParams(r.requirement_kind as StaffPayTierRequirement['requirement_kind'], r.params),
    sort_order: r.sort_order,
  }));

  const highestEligible = getHighestEligiblePromotionTier(fromTier, maxTier, requirements, metrics);

  let newToTier = fromTier;
  if (body.outcome === 'approved') {
    const requested = body.to_tier_number ?? existing.to_tier_number;
    const validationError = validateApprovedPromotionTier(fromTier, requested, highestEligible);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    newToTier = requested;

    const { data: tierRow } = await auth.admin
      .from('staff_pay_tiers')
      .select('tier_number')
      .eq('tier_number', newToTier)
      .maybeSingle();
    if (!tierRow) {
      return NextResponse.json({ error: 'Promotion target tier does not exist' }, { status: 400 });
    }
  }

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
  } else if (isApproved) {
    newStaffTier = Math.max(staff.current_tier_number, newToTier);
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
