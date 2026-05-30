import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStaffTierProgress,
  type StaffTierProgress,
  type StaffPayTier,
  type StaffTierPromotionRecord,
  type PayTierCheckIn,
  type PayTierCheckInStaffMember,
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

type SessionDetailStaffEmbed = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function parseSessionStaff(raw: unknown): SessionDetailStaffEmbed[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is SessionDetailStaffEmbed =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SessionDetailStaffEmbed).id === 'string'
  );
}

function otherStaffOnCheckIn(
  staff: SessionDetailStaffEmbed[],
  currentStaffId: string
): PayTierCheckInStaffMember[] {
  return staff
    .filter((member) => member.id !== currentStaffId)
    .map((member) => ({
      staffId: member.id,
      firstName: member.first_name,
      lastName: member.last_name,
    }));
}

async function fetchCheckIns(
  client: Client,
  currentStaffId: string,
  promotions: StaffTierPromotionRecord[]
): Promise<PayTierCheckIn[]> {
  const { data, error } = await client
    .from('vtutor_session_detail')
    .select('session_id, start_at, end_at, session_type, subject_name, staff')
    .eq('session_type', 'CHECK_IN')
    .order('start_at', { ascending: false });

  if (error) throw error;

  const promoBySession = new Map<string, StaffTierPromotionRecord>();
  for (const p of promotions) {
    if (p.check_in_session_id) {
      promoBySession.set(p.check_in_session_id, p);
    }
  }

  return (data ?? [])
    .filter((row): row is typeof row & { session_id: string; start_at: string } =>
      Boolean(row.session_id && row.start_at)
    )
    .map((row) => ({
      sessionId: row.session_id,
      startAt: row.start_at,
      endAt: row.end_at ?? null,
      displayName: row.subject_name,
      linkedPromotion: promoBySession.get(row.session_id) ?? null,
      otherStaff: otherStaffOnCheckIn(parseSessionStaff(row.staff), currentStaffId),
    }));
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
  if (
    !profile?.staff_id ||
    profile.staff_id !== staffId ||
    profile.current_tier_number == null ||
    !profile.employment_started_at
  ) {
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

  const promotionRows = (promotions.data ?? []) as StaffTierPromotionRecord[];
  const checkIns = await fetchCheckIns(client, staffId, promotionRows);
  const lastCheckIn =
    checkIns.length > 0
      ? {
          sessionId: checkIns[0]!.sessionId,
          startAt: checkIns[0]!.startAt,
          longName: checkIns[0]!.displayName,
        }
      : null;

  return buildStaffTierProgress({
    staffId: profile.staff_id,
    currentTierNumber: profile.current_tier_number,
    employmentStartedAt: profile.employment_started_at,
    metricOverrides: parseOverrides(profile.metric_overrides),
    metrics: jsonMetricsToRecord(metricsResult.data),
    tiers: (tiersResult.data ?? []).filter(
      (t): t is StaffPayTier => t.tier_number != null && t.base_pay_rate_cents != null
    ),
    requirements: (requirements.data ?? [])
      .filter(
        (r): r is typeof r & { id: string; tier_number: number; sort_order: number } =>
          r.id != null && r.tier_number != null && r.sort_order != null
      )
      .map((r) => ({
        id: r.id,
        tier_number: r.tier_number,
        requirement_kind: r.requirement_kind as StaffTierProgress['requirementsForNextTier'][0]['requirement_kind'],
        params: r.params,
        sort_order: r.sort_order,
      })),
    promotions: promotionRows,
    lastCheckIn,
    checkIns,
  });
}
