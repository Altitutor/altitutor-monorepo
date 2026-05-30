import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildStaffTierProgress,
  parseRequirementParams,
  type StaffTierProgress,
  type StaffPayTier,
  type StaffTierPromotionRecord,
  type LastCheckInInfo,
  type PayTierCheckIn,
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
    .from('sessions')
    .select('id, start_at, long_name, sessions_staff!inner(staff_id)')
    .eq('type', 'CHECK_IN')
    .eq('sessions_staff.staff_id', staffId)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data?.start_at) {
    return {
      sessionId: data.id,
      startAt: data.start_at,
      longName: data.long_name,
    };
  }

  const { data: logRows, error: logError } = await admin
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

  if (logError) throw logError;

  let best: LastCheckInInfo | null = null;
  for (const row of logRows ?? []) {
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

  const checkInRecords = await fetchStaffCheckIns(admin, staffId);
  const checkIns: PayTierCheckIn[] = checkInRecords.map((row) => ({
    sessionId: row.sessionId,
    startAt: row.startAt,
    endAt: row.endAt,
    displayName: row.longName,
    tierAtCheckIn: row.tierAtCheckIn,
    tierName: row.tierName,
    linkedPromotion: row.linkedPromotion
      ? {
          id: row.linkedPromotion.id,
          staff_id: staffId,
          from_tier_number: row.linkedPromotion.fromTierNumber,
          to_tier_number: row.linkedPromotion.toTierNumber,
          check_in_session_id: row.sessionId,
          outcome: row.linkedPromotion.outcome as StaffTierPromotionRecord['outcome'],
          notes: row.linkedPromotion.notes,
          reviewed_at: row.linkedPromotion.reviewedAt,
        }
      : null,
  }));
  const lastCheckIn =
    checkIns.length > 0
      ? {
          sessionId: checkIns[0]!.sessionId,
          startAt: checkIns[0]!.startAt,
          longName: checkIns[0]!.displayName,
        }
      : await fetchLastCheckInForStaff(admin, staffId);

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
    checkIns,
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

export interface StaffCheckInRecord {
  sessionId: string;
  tutorLogId: string;
  startAt: string;
  endAt: string | null;
  longName: string | null;
  tierAtCheckIn: number;
  tierName: string | null;
  linkedPromotion: {
    id: string;
    outcome: string;
    fromTierNumber: number;
    toTierNumber: number;
    notes: string | null;
    reviewedAt: string;
  } | null;
}

function tierAtDate(
  atIso: string,
  employmentStartedAt: string,
  approvedPromotions: Array<{ reviewed_at: string; to_tier_number: number }>
): number {
  const at = new Date(atIso).getTime();
  let tier = 1;
  const sorted = [...approvedPromotions].sort(
    (a, b) => new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime()
  );
  for (const p of sorted) {
    if (new Date(p.reviewed_at).getTime() <= at) {
      tier = p.to_tier_number;
    }
  }
  if (new Date(employmentStartedAt).getTime() > at) {
    return 1;
  }
  return tier;
}

type SessionCheckInLogEmbed = {
  id: string;
  tutor_logs_staff_attendance: Array<{ staff_id: string; attended: boolean | null }> | null;
};

type SessionCheckInStaffEmbed = {
  staff_id: string;
};

type SessionCheckInRow = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  long_name: string | null;
  tutor_logs: SessionCheckInLogEmbed | SessionCheckInLogEmbed[] | null;
  sessions_staff?: SessionCheckInStaffEmbed | SessionCheckInStaffEmbed[] | null;
};

function normalizeTutorLogs(
  logs: SessionCheckInLogEmbed | SessionCheckInLogEmbed[] | null | undefined
): SessionCheckInLogEmbed[] {
  if (!logs) return [];
  return Array.isArray(logs) ? logs : [logs];
}

function normalizeSessionsStaff(
  staff: SessionCheckInStaffEmbed | SessionCheckInStaffEmbed[] | null | undefined
): SessionCheckInStaffEmbed[] {
  if (!staff) return [];
  return Array.isArray(staff) ? staff : [staff];
}

async function fetchStaffCheckInSessionsPage(
  admin: AdminClient,
  staffId: string,
  source: 'sessions_staff' | 'tutor_logs',
  from: number,
  pageSize: number
): Promise<SessionCheckInRow[]> {
  const select =
    source === 'sessions_staff'
      ? `
        id,
        start_at,
        end_at,
        long_name,
        sessions_staff!inner (staff_id),
        tutor_logs (
          id,
          tutor_logs_staff_attendance (staff_id, attended)
        )
      `
      : `
        id,
        start_at,
        end_at,
        long_name,
        tutor_logs!inner (
          id,
          tutor_logs_staff_attendance!inner (staff_id, attended)
        )
      `;

  let query = admin
    .from('sessions')
    .select(select)
    .eq('type', 'CHECK_IN')
    .order('start_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (source === 'sessions_staff') {
    query = query.eq('sessions_staff.staff_id', staffId);
  } else {
    query = query.eq('tutor_logs.tutor_logs_staff_attendance.staff_id', staffId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SessionCheckInRow[];
}

async function fetchStaffCheckInSessionsBySource(
  admin: AdminClient,
  staffId: string,
  source: 'sessions_staff' | 'tutor_logs'
): Promise<SessionCheckInRow[]> {
  const pageSize = 1000;
  let from = 0;
  const out: SessionCheckInRow[] = [];
  for (;;) {
    const chunk = await fetchStaffCheckInSessionsPage(admin, staffId, source, from, pageSize);
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function mergeStaffCheckInSessions(
  booked: SessionCheckInRow[],
  logged: SessionCheckInRow[]
): SessionCheckInRow[] {
  const byId = new Map<string, SessionCheckInRow>();
  for (const session of booked) {
    byId.set(session.id, session);
  }
  for (const session of logged) {
    const existing = byId.get(session.id);
    if (existing) {
      byId.set(session.id, {
        ...existing,
        tutor_logs: session.tutor_logs ?? existing.tutor_logs,
      });
    } else {
      byId.set(session.id, session);
    }
  }
  return [...byId.values()];
}

/** Booked check-ins use sessions_staff; logged attendance may also appear on tutor_logs. */
async function fetchStaffCheckInSessions(
  admin: AdminClient,
  staffId: string
): Promise<SessionCheckInRow[]> {
  const [booked, logged] = await Promise.all([
    fetchStaffCheckInSessionsBySource(admin, staffId, 'sessions_staff'),
    fetchStaffCheckInSessionsBySource(admin, staffId, 'tutor_logs'),
  ]);
  return mergeStaffCheckInSessions(booked, logged);
}

function staffAttendedCheckIn(session: SessionCheckInRow, staffId: string): boolean {
  if (normalizeSessionsStaff(session.sessions_staff).some((s) => s.staff_id === staffId)) {
    return true;
  }
  for (const log of normalizeTutorLogs(session.tutor_logs)) {
    for (const att of log.tutor_logs_staff_attendance ?? []) {
      if (att.staff_id === staffId && att.attended === true) return true;
    }
  }
  return false;
}

export async function fetchStaffCheckIns(
  admin: AdminClient,
  staffId: string
): Promise<StaffCheckInRecord[]> {
  const [staffResult, tiers, sessions, promotionsResult] = await Promise.all([
    admin
      .from('staff')
      .select('employment_started_at')
      .eq('id', staffId)
      .single(),
    fetchPayTiers(admin),
    fetchStaffCheckInSessions(admin, staffId),
    admin
      .from('staff_tier_promotions')
      .select(
        'id, from_tier_number, to_tier_number, check_in_session_id, outcome, notes, reviewed_at'
      )
      .eq('staff_id', staffId)
      .order('reviewed_at', { ascending: false }),
  ]);

  if (staffResult.error || !staffResult.data) {
    throw staffResult.error ?? new Error('Staff not found');
  }
  if (promotionsResult.error) throw promotionsResult.error;

  const tierByNumber = new Map(tiers.map((t) => [t.tier_number, t]));
  const approved = (promotionsResult.data ?? []).filter((p) => p.outcome === 'approved');
  const promoBySession = new Map(
    (promotionsResult.data ?? [])
      .filter((p) => p.check_in_session_id)
      .map((p) => [p.check_in_session_id!, p])
  );

  const rows: StaffCheckInRecord[] = [];
  for (const session of sessions) {
    if (!session.start_at || !staffAttendedCheckIn(session, staffId)) continue;

    const linked = promoBySession.get(session.id);
    const tierNumber = linked
      ? linked.from_tier_number
      : tierAtDate(session.start_at, staffResult.data.employment_started_at, approved);

    const tierMeta = tierByNumber.get(tierNumber);
    const firstLog = normalizeTutorLogs(session.tutor_logs)[0];
    rows.push({
      sessionId: session.id,
      tutorLogId: firstLog?.id ?? session.id,
      startAt: session.start_at,
      endAt: session.end_at,
      longName: session.long_name,
      tierAtCheckIn: tierNumber,
      tierName: tierMeta?.name ?? null,
      linkedPromotion: linked
        ? {
            id: linked.id,
            outcome: linked.outcome,
            fromTierNumber: linked.from_tier_number,
            toTierNumber: linked.to_tier_number,
            notes: linked.notes,
            reviewedAt: linked.reviewed_at,
          }
        : null,
    });
  }

  rows.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return rows;
}

export { parseRequirementParams };
