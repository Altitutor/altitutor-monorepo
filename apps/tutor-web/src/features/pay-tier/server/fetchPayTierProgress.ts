import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStaffTierProgress,
  type StaffTierProgress,
  type StaffPayTier,
  type StaffTierPromotionRecord,
  type LastCheckInInfo,
} from '@altitutor/shared/pay-tiers';
import type { Database } from '@altitutor/shared';

type Client = SupabaseClient<Database>;

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

async function fetchLastCheckIn(client: Client, staffId: string): Promise<LastCheckInInfo | null> {
  const { data, error } = await client
    .from('tutor_logs')
    .select(
      `
      id,
      sessions!inner ( id, start_at, long_name ),
      tutor_logs_staff_attendance!inner ( staff_id, attended )
    `
    )
    .eq('session_type', 'CHECK_IN')
    .eq('tutor_logs_staff_attendance.staff_id', staffId)
    .eq('tutor_logs_staff_attendance.attended', true)
    .order('id', { ascending: false })
    .limit(50);

  if (error) return null;

  let best: LastCheckInInfo | null = null;
  for (const row of data ?? []) {
    const sessions = row.sessions as
      | { id: string; start_at: string | null; long_name: string | null }
      | { id: string; start_at: string | null; long_name: string | null }[]
      | null;
    const session = Array.isArray(sessions) ? sessions[0] : sessions;
    if (!session?.start_at) continue;
    const t = new Date(session.start_at).getTime();
    if (!best || t > new Date(best.startAt).getTime()) {
      best = { sessionId: session.id, startAt: session.start_at, longName: session.long_name };
    }
  }
  return best;
}

/**
 * Tutor-web: read pay tier data through vtutor_* views (not base tables).
 * See supabase/migrations/20260530140000_vtutor_pay_tier_views.sql
 */
export async function fetchPayTierProgressForStaff(
  client: Client,
  staffId: string
): Promise<StaffTierProgress> {
  const { data: profile, error: profileError } = await client
    .from('vtutor_pay_tier_profile')
    .select('staff_id, current_tier_number, employment_started_at, metric_overrides')
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.staff_id !== staffId) {
    throw new Error('Staff not found');
  }

  const [tiersResult, requirements, promotions, metricsResult] = await Promise.all([
    client
      .from('vtutor_pay_tiers')
      .select('tier_number, name, base_pay_rate_cents, currency')
      .order('tier_number', { ascending: true }),
    client
      .from('vtutor_pay_tier_requirements')
      .select('id, tier_number, requirement_kind, params, sort_order')
      .order('tier_number')
      .order('sort_order'),
    client
      .from('vtutor_staff_tier_promotions')
      .select(
        'id, staff_id, from_tier_number, to_tier_number, check_in_session_id, outcome, notes, reviewed_at'
      )
      .order('reviewed_at', { ascending: false })
      .limit(20),
    client.rpc('compute_staff_tier_metrics', { p_staff_id: staffId }),
  ]);

  if (tiersResult.error) throw tiersResult.error;
  if (requirements.error) throw requirements.error;
  if (promotions.error) throw promotions.error;
  if (metricsResult.error) throw metricsResult.error;

  const lastCheckIn = await fetchLastCheckIn(client, staffId);

  return buildStaffTierProgress({
    staffId: profile.staff_id,
    currentTierNumber: profile.current_tier_number,
    employmentStartedAt: profile.employment_started_at,
    metricOverrides: parseOverrides(profile.metric_overrides),
    metrics: jsonMetricsToRecord(metricsResult.data),
    tiers: (tiersResult.data ?? []) as StaffPayTier[],
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
