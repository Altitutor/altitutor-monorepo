import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { FamilyCheckInRow } from '../types';

type SessionEmbed = {
  id: string;
  start_at: string | null;
  long_name: string | null;
};

type StaffAttendanceEmbed = { staff_id: string; attended: boolean | null };
type StudentAttendanceEmbed = { student_id: string; attended: boolean | null };
type ParentAttendanceEmbed = { parent_id: string; attended: boolean | null };

type TutorLogCheckInStaff = {
  sessions: SessionEmbed | SessionEmbed[] | null;
  tutor_logs_staff_attendance: StaffAttendanceEmbed[] | null;
};

type TutorLogCheckInStudent = {
  sessions: SessionEmbed | SessionEmbed[] | null;
  tutor_logs_student_attendance: StudentAttendanceEmbed[] | null;
};

type TutorLogCheckInParent = {
  sessions: SessionEmbed | SessionEmbed[] | null;
  tutor_logs_parent_attendance: ParentAttendanceEmbed[] | null;
};

type LastCheckIn = {
  sessionId: string;
  startAt: string;
  longName: string | null;
};

function normalizeSession(s: SessionEmbed | SessionEmbed[] | null): SessionEmbed | null {
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function mergeLast(
  map: Map<string, LastCheckIn>,
  entityId: string,
  session: SessionEmbed,
  attended: boolean | null | undefined
): void {
  if (!attended || !session.start_at) return;
  const prev = map.get(entityId);
  const t = new Date(session.start_at).getTime();
  if (!prev || t > new Date(prev.startAt).getTime()) {
    map.set(entityId, {
      sessionId: session.id,
      startAt: session.start_at,
      longName: session.long_name,
    });
  }
}

async function fetchAllCheckInTutorLogs<T extends Record<string, unknown>>(
  supabase: SupabaseClient<Database>,
  select: string
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('tutor_logs')
      .select(select)
      .eq('session_type', 'CHECK_IN')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function buildStaffLastMap(rows: TutorLogCheckInStaff[]): Map<string, LastCheckIn> {
  const map = new Map<string, LastCheckIn>();
  for (const row of rows) {
    const session = normalizeSession(row.sessions);
    if (!session) continue;
    for (const att of row.tutor_logs_staff_attendance ?? []) {
      mergeLast(map, att.staff_id, session, att.attended);
    }
  }
  return map;
}

function buildStudentLastMap(rows: TutorLogCheckInStudent[]): Map<string, LastCheckIn> {
  const map = new Map<string, LastCheckIn>();
  for (const row of rows) {
    const session = normalizeSession(row.sessions);
    if (!session) continue;
    for (const att of row.tutor_logs_student_attendance ?? []) {
      mergeLast(map, att.student_id, session, att.attended);
    }
  }
  return map;
}

function buildParentLastMap(rows: TutorLogCheckInParent[]): Map<string, LastCheckIn> {
  const map = new Map<string, LastCheckIn>();
  for (const row of rows) {
    const session = normalizeSession(row.sessions);
    if (!session) continue;
    for (const att of row.tutor_logs_parent_attendance ?? []) {
      mergeLast(map, att.parent_id, session, att.attended);
    }
  }
  return map;
}

async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = data ?? [];
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function fetchFamilyCheckInsData(): Promise<{
  staff: FamilyCheckInRow[];
  students: FamilyCheckInRow[];
  parents: FamilyCheckInRow[];
}> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;

  const staffSelect = `
    sessions ( id, start_at, long_name ),
    tutor_logs_staff_attendance ( staff_id, attended )
  `;
  const studentSelect = `
    sessions ( id, start_at, long_name ),
    tutor_logs_student_attendance ( student_id, attended )
  `;
  const parentSelect = `
    sessions ( id, start_at, long_name ),
    tutor_logs_parent_attendance ( parent_id, attended )
  `;

  const [staffList, studentList, parentList, logStaff, logStudents, logParents] = await Promise.all([
    fetchAllRows(async (from, to) => {
      const r = await supabase
        .from('staff')
        .select('id, first_name, last_name, status')
        .eq('status', 'ACTIVE')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .range(from, to);
      return { data: r.data as { id: string; first_name: string; last_name: string; status: string }[] | null, error: r.error };
    }),
    fetchAllRows(async (from, to) => {
      const r = await supabase
        .from('students')
        .select('id, first_name, last_name, status')
        .in('status', ['ACTIVE', 'TRIAL'])
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .range(from, to);
      return { data: r.data as { id: string; first_name: string; last_name: string; status: string }[] | null, error: r.error };
    }),
    fetchAllRows(async (from, to) => {
      const r = await supabase
        .from('parents')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .range(from, to);
      return { data: r.data as { id: string; first_name: string; last_name: string }[] | null, error: r.error };
    }),
    fetchAllCheckInTutorLogs<TutorLogCheckInStaff>(supabase, staffSelect),
    fetchAllCheckInTutorLogs<TutorLogCheckInStudent>(supabase, studentSelect),
    fetchAllCheckInTutorLogs<TutorLogCheckInParent>(supabase, parentSelect),
  ]);

  const staffLast = buildStaffLastMap(logStaff);
  const studentLast = buildStudentLastMap(logStudents);
  const parentLast = buildParentLastMap(logParents);

  const staff: FamilyCheckInRow[] = staffList.map((s) => {
    const last = staffLast.get(s.id);
    return {
      entityId: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      lastCheckInSessionId: last?.sessionId ?? null,
      lastCheckInAt: last?.startAt ?? null,
      lastCheckInLongName: last?.longName ?? null,
    };
  });

  const students: FamilyCheckInRow[] = studentList.map((s) => {
    const last = studentLast.get(s.id);
    return {
      entityId: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      lastCheckInSessionId: last?.sessionId ?? null,
      lastCheckInAt: last?.startAt ?? null,
      lastCheckInLongName: last?.longName ?? null,
    };
  });

  const parents: FamilyCheckInRow[] = parentList.map((p) => {
    const last = parentLast.get(p.id);
    return {
      entityId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      lastCheckInSessionId: last?.sessionId ?? null,
      lastCheckInAt: last?.startAt ?? null,
      lastCheckInLongName: last?.longName ?? null,
    };
  });

  return { staff, students, parents };
}
