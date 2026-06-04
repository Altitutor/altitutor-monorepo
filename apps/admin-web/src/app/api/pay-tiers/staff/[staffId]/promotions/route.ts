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
    to_tier_number?: number;
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

  let toTier = fromTier;
  if (body.outcome === 'approved') {
    const requested = body.to_tier_number ?? fromTier + 1;
    const validationError = validateApprovedPromotionTier(fromTier, requested, highestEligible);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    toTier = requested;

    const { data: tierRow } = await auth.admin
      .from('staff_pay_tiers')
      .select('tier_number')
      .eq('tier_number', toTier)
      .maybeSingle();
    if (!tierRow) {
      return NextResponse.json({ error: 'Promotion target tier does not exist' }, { status: 400 });
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

    const { data: existingReview } = await auth.admin
      .from('staff_tier_promotions')
      .select('id')
      .eq('staff_id', params.staffId)
      .eq('check_in_session_id', body.check_in_session_id)
      .maybeSingle();
    if (existingReview) {
      return NextResponse.json(
        { error: 'A promotion review already exists for this check-in session' },
        { status: 409 }
      );
    }
  }

  const { error: promoError } = await auth.admin.from('staff_tier_promotions').insert({
    staff_id: params.staffId,
    from_tier_number: fromTier,
    to_tier_number: toTier,
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
