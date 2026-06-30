import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { UcatOnlineTier } from '@altitutor/shared';

type UcatQuotaArea = 'practice' | 'sets' | 'mocks' | 'learn' | 'skill_trainer';
type UcatQuotaPeriod = 'day' | 'week' | 'month';

const QUOTA_AREAS: UcatQuotaArea[] = ['learn', 'practice', 'sets', 'mocks', 'skill_trainer'];

const AREA_LABELS: Record<UcatQuotaArea, string> = {
  practice: 'Practice questions',
  sets: 'Sets',
  mocks: 'Mocks',
  learn: 'Learning modules',
  skill_trainer: 'Skill trainer attempts',
};

type QuotaConfig = Record<UcatQuotaArea, { limit: number; period: UcatQuotaPeriod }>;

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  timezone: string | null;
};

function parsePeriod(value: string | null | undefined): UcatQuotaPeriod {
  return value === 'week' || value === 'month' ? value : 'day';
}

function normalizeArea(value: unknown): UcatQuotaArea | null {
  return typeof value === 'string' && QUOTA_AREAS.includes(value as UcatQuotaArea)
    ? (value as UcatQuotaArea)
    : null;
}

async function requireAdminStaff() {
  const userClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Server not configured' }, { status: 503 }) };
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('staff')
    .select('id, role, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffError || !staff || staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { staffId: staff.id };
}

async function loadQuotaConfig(): Promise<QuotaConfig> {
  const { data } = await supabaseAdmin!
    .from('ucat_subscription_config')
    .select(
      'free_practice_limit, free_practice_period, free_sets_limit, free_sets_period, free_mocks_limit, free_mocks_period, free_learn_limit, free_learn_period, free_skill_trainer_limit, free_skill_trainer_period',
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    practice: {
      limit: data?.free_practice_limit ?? 20,
      period: parsePeriod(data?.free_practice_period),
    },
    sets: {
      limit: data?.free_sets_limit ?? 2,
      period: parsePeriod(data?.free_sets_period),
    },
    mocks: {
      limit: data?.free_mocks_limit ?? 1,
      period: parsePeriod(data?.free_mocks_period),
    },
    learn: {
      limit: data?.free_learn_limit ?? 3,
      period: parsePeriod(data?.free_learn_period),
    },
    skill_trainer: {
      limit: data?.free_skill_trainer_limit ?? 5,
      period: parsePeriod(data?.free_skill_trainer_period),
    },
  };
}

function getQuotaPeriodStart(period: UcatQuotaPeriod, timezone: string, at = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(at);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);

  if (period === 'day') return zonedMidnightUtc(y, m, d, timezone);
  if (period === 'week') {
    const local = new Date(Date.UTC(y, m - 1, d));
    const isoDow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const monday = new Date(Date.UTC(y, m - 1, d - (isoDow - 1)));
    return zonedMidnightUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timezone);
  }
  return zonedMidnightUtc(y, m, 1, timezone);
}

function zonedEndOfDayUtc(date: string, timezone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return new Date(zonedMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone).getTime() - 1);
}

function zonedMidnightUtc(year: number, month: number, day: number, timezone: string): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let candidateMs = targetAsUtc - getTimezoneOffsetMs(new Date(targetAsUtc), timezone);
  const seen = new Set<number>();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isLocalMidnight(candidateMs, year, month, day, timezone)) return new Date(candidateMs);
    seen.add(candidateMs);
    const nextMs = targetAsUtc - getTimezoneOffsetMs(new Date(candidateMs), timezone);
    if (nextMs === candidateMs || seen.has(nextMs)) break;
    candidateMs = nextMs;
  }

  return new Date(findFirstInstantForLocalDate(year, month, day, timezone, targetAsUtc));
}

function isLocalMidnight(instantMs: number, year: number, month: number, day: number, timezone: string): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return read('year') === year && read('month') === month && read('day') === day && read('hour') === 0 && read('minute') === 0;
}

function findFirstInstantForLocalDate(year: number, month: number, day: number, timezone: string, targetAsUtc: number): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const targetDateOrdinal = Date.UTC(year, month - 1, day);
  const localDateOrdinal = (instantMs: number) => {
    const parts = formatter.formatToParts(new Date(instantMs));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(read('year'), read('month') - 1, read('day'));
  };

  let low = targetAsUtc - 48 * 60 * 60 * 1000;
  let high = targetAsUtc + 48 * 60 * 60 * 1000;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDateOrdinal(middle) >= targetDateOrdinal) high = middle;
    else low = middle;
  }
  return high;
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utc = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const read = (parts: Intl.DateTimeFormatPart[]) => ({
    y: Number(parts.find((p) => p.type === 'year')?.value),
    m: Number(parts.find((p) => p.type === 'month')?.value),
    d: Number(parts.find((p) => p.type === 'day')?.value),
    h: normalizeHour(Number(parts.find((p) => p.type === 'hour')?.value)),
    min: Number(parts.find((p) => p.type === 'minute')?.value),
  });
  const u = read(utc);
  const l = read(local);
  return Date.UTC(l.y, l.m - 1, l.d, l.h, l.min) - Date.UTC(u.y, u.m - 1, u.d, u.h, u.min);
}

function normalizeHour(hour: number): number {
  return hour === 24 ? 0 : hour;
}

async function getCountStart(student: StudentRow, area: UcatQuotaArea, config: QuotaConfig): Promise<string> {
  const timezone = student.timezone ?? 'Australia/Adelaide';
  const periodStart = getQuotaPeriodStart(config[area].period, timezone).toISOString();
  const { data, error } = await supabaseAdmin!.rpc('get_ucat_free_quota_reset_boundary', {
    p_student_id: student.id,
    p_quota_area: area,
  });
  if (error) throw new Error(error.message);
  return data && new Date(data).getTime() > new Date(periodStart).getTime() ? data : periodStart;
}

async function countAreaUsage(student: StudentRow, area: UcatQuotaArea, config: QuotaConfig): Promise<number> {
  if (config[area].limit <= 0) return 0;
  const countStart = await getCountStart(student, area, config);

  if (area === 'practice') {
    const { data, error } = await supabaseAdmin!
      .from('student_question_attempts')
      .select('question_id')
      .eq('student_id', student.id)
      .not('student_practice_session_id', 'is', null)
      .is('student_question_set_attempt_id', null)
      .or('question_answer_option_id.not.is.null,answer_snapshot.not.is.null,is_submitted.eq.true')
      .gte('attempted_at', countStart);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((row) => row.question_id)).size;
  }

  if (area === 'sets') {
    const { count, error } = await supabaseAdmin!
      .from('student_question_set_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .is('student_ucat_mock_attempt_id', null)
      .gte('attempted_at', countStart);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  if (area === 'mocks') {
    const { count, error } = await supabaseAdmin!
      .from('student_ucat_mock_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .gte('attempted_at', countStart);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  if (area === 'learn') {
    const { count, error } = await supabaseAdmin!
      .from('ucat_student_learning_module_progress')
      .select('id, ucat_learning_modules!inner(kind)', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('ucat_learning_modules.kind', 'lesson')
      .gte('started_at', countStart);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  const { count, error } = await supabaseAdmin!
    .from('student_skill_trainer_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .is('learning_module_block_id', null)
    .gte('started_at', countStart);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminStaff();
  if ('error' in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const search = params.get('search')?.trim() ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize') ?? '50') || 50));
  const statuses = (params.get('status')?.split(',').filter(Boolean) ?? ['ACTIVE', 'TRIAL']);

  let query = supabaseAdmin!
    .from('students')
    .select('id, first_name, last_name, email, status, timezone')
    .in('status', statuses);

  if (search) {
    const q = `%${search}%`;
    query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`);
  }

  const { data: students, error: studentsError } = await query
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true });

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const freeStudents: StudentRow[] = [];
  for (const student of (students ?? []) as StudentRow[]) {
    const { data: tier, error } = await supabaseAdmin!.rpc('get_student_ucat_online_tier', {
      p_student_id: student.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((tier as UcatOnlineTier | null) === 'free') freeStudents.push(student);
  }

  const total = freeStudents.length;
  const pageStudents = freeStudents.slice((page - 1) * pageSize, page * pageSize);
  const config = await loadQuotaConfig();

  const rows = await Promise.all(
    pageStudents.map(async (student) => {
      const quotas = await Promise.all(
        QUOTA_AREAS.map(async (area) => {
          const used = await countAreaUsage(student, area, config);
          const quota = config[area];
          return {
            area,
            label: AREA_LABELS[area],
            used,
            limit: quota.limit,
            period: quota.period,
            disabled: quota.limit === 0,
            atLimit: quota.limit > 0 && used >= quota.limit,
          };
        }),
      );
      return { ...student, quotas };
    }),
  );

  return NextResponse.json({ rows, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminStaff();
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    studentIds?: string[];
    expiresOn?: string;
    area?: string;
  } | null;

  const studentIds = Array.from(new Set(body?.studentIds?.filter(Boolean) ?? []));
  if (studentIds.length === 0) {
    return NextResponse.json({ error: 'No students selected' }, { status: 400 });
  }

  if (body?.action === 'grant_entitlement') {
    if (!body.expiresOn) {
      return NextResponse.json({ error: 'Expiry date is required' }, { status: 400 });
    }

    const { data: students, error: studentsError } = await supabaseAdmin!
      .from('students')
      .select('id, timezone')
      .in('id', studentIds);
    if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 });

    const rows = (students ?? []).map((student) => {
      const expiresAt = zonedEndOfDayUtc(body.expiresOn!, student.timezone ?? 'Australia/Adelaide');
      if (!expiresAt) return null;
      return {
        student_id: student.id,
        granted_by_staff_id: auth.staffId,
        expires_at: expiresAt.toISOString(),
      };
    });

    if (rows.some((row) => row == null)) {
      return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
    }

    const { error } = await supabaseAdmin!
      .from('ucat_free_quota_reset_entitlements')
      .insert(rows as NonNullable<(typeof rows)[number]>[]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'reset_area') {
    const area = normalizeArea(body.area);
    if (!area) return NextResponse.json({ error: 'Invalid quota area' }, { status: 400 });

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin!
      .from('ucat_free_quota_reset_events')
      .insert(
        studentIds.map((studentId) => ({
          student_id: studentId,
          quota_area: area,
          reset_at: now,
          source: 'admin',
          created_by_staff_id: auth.staffId,
        })),
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
