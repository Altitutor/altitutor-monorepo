import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStaffTierProgress,
  parseRequirementParams,
  type StaffTierProgress,
  type StaffPayTier,
  type StaffTierPromotionRecord,
  type LastCheckInInfo,
} from '@altitutor/shared/pay-tiers';
import type { Database } from '@altitutor/shared';

type AdminClient = SupabaseClient<Database>;

function jsonMetricsToRecord(metrics: unknown): Record<string, number> {
  if (!metrics || typeof metrics !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(metrics as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

function parseOverrides(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

export async function fetchPayTiers(admin: AdminClient): Promise<StaffPayTier[]> {
  const { data, error } = await admin
    .from('staff_pay_tiers')
    .select('tier_number, name, base_pay_rate_cents, currency')
    .order('tier_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StaffPayTier[];
}

export async function fetchLastCheckInForStaff(
  admin: AdminClient,
  staffId: string
): Promise<LastCheckInInfo | null> {
  const { data, error } = await admin
    .from('tutor_logs')
    .select(
      `
      id,
      sessions!inner (
        id,
        start_at,
        long_name,
        type
      ),
      tutor_logs_staff_attendance!inner (
        staff_id,
        attended
      )
    `
    )
    .eq('session_type', 'CHECK_IN')
    .eq('tutor_logs_staff_attendance.staff_id', staffId)
    .eq('tutor_logs_staff_attendance.attended', true)
    .order('id', { ascending: false })
    .limit(50);

  if (error) throw error;

  let best: LastCheckInInfo | null = null;
  for (const row of data ?? []) {
    const sessions = row.sessions as
      | { id: string; start_at: string | null; long_name: string | null; type: string }
      | { id: string; start_at: string | null; long_name: string | null; type: string }[]
      | null;
    const session = Array.isArray(sessions) ? sessions[0] : sessions;
    if (!session?.start_at) continue;
    const t = new Date(session.start_at).getTime();
    if (!best || t > new Date(best.startAt).getTime()) {
      best = {
        sessionId: session.id,
        startAt: session.start_at,
        longName: session.long_name,
      };
    }
  }
  return best;
}

export async function fetchStaffTierProgress(
  admin: AdminClient,
  staffId: string
): Promise<StaffTierProgress> {
  const { data: staff, error: staffError } = await admin
    .from('staff')
    .select('id, current_tier_number, employment_started_at, metric_overrides')
    .eq('id', staffId)
    .single();
  if (staffError || !staff) throw staffError ?? new Error('Staff not found');

  const [tiers, requirements, promotions, metricsResult] = await Promise.all([
    fetchPayTiers(admin),
    admin
      .from('staff_pay_tier_requirements')
      .select('id, tier_number, requirement_kind, params, sort_order')
      .order('tier_number')
      .order('sort_order'),
    admin
      .from('staff_tier_promotions')
      .select(
        'id, staff_id, from_tier_number, to_tier_number, check_in_session_id, outcome, notes, reviewed_at'
      )
      .eq('staff_id', staffId)
      .order('reviewed_at', { ascending: false })
      .limit(20),
    admin.rpc('compute_staff_tier_metrics', { p_staff_id: staffId }),
  ]);

  if (requirements.error) throw requirements.error;
  if (promotions.error) throw promotions.error;
  if (metricsResult.error) throw metricsResult.error;

  const lastCheckIn = await fetchLastCheckInForStaff(admin, staffId);

  return buildStaffTierProgress({
    staffId: staff.id,
    currentTierNumber: staff.current_tier_number,
    employmentStartedAt: staff.employment_started_at,
    metricOverrides: parseOverrides(staff.metric_overrides),
    metrics: jsonMetricsToRecord(metricsResult.data),
    tiers,
    requirements: (requirements.data ?? []).map((r) => ({
      id: r.id,
      tier_number: r.tier_number,
      requirement_kind: r.requirement_kind as StaffTierProgress['requirementsForNextTier'][0]['requirement_kind'],
      params: r.params,
      sort_order: r.sort_order,
    })),
    promotions: (promotions.data ?? []) as StaffTierPromotionRecord[],
    lastCheckIn,
  });
}

export async function fetchAllStaffTierSummaries(admin: AdminClient): Promise<
  Array<{
    staffId: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    currentTierNumber: number;
    nextTierNumber: number | null;
    isEligibleForReview: boolean;
    lastCheckIn: LastCheckInInfo | null;
  }>
> {
  const { data: staffList, error } = await admin
    .from('staff')
    .select('id, first_name, last_name, role, status, current_tier_number')
    .eq('status', 'ACTIVE')
    .order('last_name');
  if (error) throw error;

  const tiers = await fetchPayTiers(admin);
  const maxTier = tiers.length > 0 ? tiers[tiers.length - 1]!.tier_number : 1;

  const summaries = await Promise.all(
    (staffList ?? []).map(async (s) => {
      let isEligible = false;
      let nextTier: number | null =
        s.current_tier_number < maxTier ? s.current_tier_number + 1 : null;
      try {
        const progress = await fetchStaffTierProgress(admin, s.id);
        isEligible = progress.isEligibleForReview;
        nextTier = progress.nextTierNumber;
        return {
          staffId: s.id,
          firstName: s.first_name,
          lastName: s.last_name,
          role: s.role,
          status: s.status,
          currentTierNumber: s.current_tier_number,
          nextTierNumber: nextTier,
          isEligibleForReview: isEligible,
          lastCheckIn: progress.lastCheckIn,
        };
      } catch {
        return {
          staffId: s.id,
          firstName: s.first_name,
          lastName: s.last_name,
          role: s.role,
          status: s.status,
          currentTierNumber: s.current_tier_number,
          nextTierNumber: nextTier,
          isEligibleForReview: false,
          lastCheckIn: null,
        };
      }
    })
  );

  return summaries;
}

export { parseRequirementParams };
