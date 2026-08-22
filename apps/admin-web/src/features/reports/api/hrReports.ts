import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eachDayOfInterval, endOfDay, format, startOfDay } from 'date-fns';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { HrStatsReportData, ReportDataPoint, ReportEntityLink } from '../types';

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type CheckInRow = {
  id: string;
  session: { id: string; start_at: string | null; long_name: string | null } | null;
  creator: Person | null;
  staffAttendance: Array<{ id: string; attended: boolean; type: string; staff: Person | null }>;
  studentAttendance: Array<{ id: string; attended: boolean; student: Person | null }>;
  parentAttendance: Array<{ id: string; attended: boolean; parent: Person | null }>;
};

type FormCompletionRow = {
  id: string;
  form_id: string;
  submitted_at: string;
  form: { name: string; purpose: string } | null;
  recordedBy: Person | null;
};

function dateKey(value: Date | string): string {
  return format(new Date(value), 'yyyy-MM-dd');
}

function personName(person: Person | null, fallback: string): string {
  if (!person) return fallback;
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || fallback;
}

function emptySeries(days: Date[]): ReportDataPoint[] {
  return days.map((day) => ({ date: dateKey(day), count: 0, entities: [] }));
}

function formatTypeLabel(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export async function fetchHrStatsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<HrStatsReportData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const start = startOfDay(periodStart);
  const end = endOfDay(periodEnd);
  const days = eachDayOfInterval({ start, end });

  const [checkInsResult, formsResult] = await Promise.all([
    supabase
      .from('tutor_logs')
      .select(`
        id,
        session:sessions!inner(id, start_at, long_name),
        creator:staff!tutor_logs_created_by_fkey(id, first_name, last_name),
        staffAttendance:tutor_logs_staff_attendance(id, attended, type, staff:staff!tutor_logs_staff_attendance_staff_id_fkey(id, first_name, last_name)),
        studentAttendance:tutor_logs_student_attendance(id, attended, student:students!tutor_logs_student_attendance_student_id_fkey(id, first_name, last_name)),
        parentAttendance:tutor_logs_parent_attendance(id, attended, parent:parents!tutor_logs_parent_attendance_parent_id_fkey(id, first_name, last_name))
      `)
      .eq('session_type', 'CHECK_IN'),
    supabase
      .from('form_responses')
      .select(`
        id,
        form_id,
        submitted_at,
        form:forms!inner(name, purpose),
        recordedBy:staff!form_responses_recorded_by_staff_id_fkey(id, first_name, last_name)
      `)
      .gte('submitted_at', start.toISOString())
      .lte('submitted_at', end.toISOString())
      .is('deleted_at', null),
  ]);

  if (checkInsResult.error) throw checkInsResult.error;
  if (formsResult.error) throw formsResult.error;

  const staffCheckInsByDay = emptySeries(days);
  const studentCheckInsByDay = emptySeries(days);
  const parentCheckInsByDay = emptySeries(days);
  const indexByDate = new Map(staffCheckInsByDay.map((point, index) => [point.date, index]));
  const checkIns = (checkInsResult.data ?? []) as unknown as CheckInRow[];

  for (const checkIn of checkIns) {
    if (!checkIn.session?.start_at) continue;
    const occurredAt = new Date(checkIn.session.start_at);
    if (occurredAt < start || occurredAt > end) continue;
    const index = indexByDate.get(dateKey(occurredAt));
    if (index === undefined) continue;
    const recordedBy = personName(checkIn.creator, 'Unknown staff');
    const sessionDate = format(occurredAt, 'd MMM yyyy, h:mm a');

    for (const attendance of checkIn.staffAttendance ?? []) {
      if (!attendance.attended || !['CHECK_IN_RECEIVER', 'MAIN_TUTOR'].includes(attendance.type)) {
        continue;
      }
      const staff = personName(attendance.staff, 'Unknown staff');
      const point = staffCheckInsByDay[index];
      point.count += 1;
      point.entities.push({
        id: attendance.id,
        name: staff,
        link: {
          kind: 'staff' as ReportEntityLink['kind'],
          staffId: attendance.staff?.id,
          sessionId: checkIn.session.id,
        },
        meta: { staff, sessionDate, loggedBy: recordedBy },
      });
    }

    for (const attendance of checkIn.studentAttendance ?? []) {
      if (!attendance.attended) continue;
      const student = personName(attendance.student, 'Unknown student');
      const point = studentCheckInsByDay[index];
      point.count += 1;
      point.entities.push({
        id: attendance.id,
        name: student,
        link: {
          kind: 'student' as ReportEntityLink['kind'],
          studentId: attendance.student?.id,
          sessionId: checkIn.session.id,
        },
        meta: { student, sessionDate, loggedBy: recordedBy },
      });
    }

    for (const attendance of checkIn.parentAttendance ?? []) {
      if (!attendance.attended) continue;
      const parent = personName(attendance.parent, 'Unknown parent');
      const point = parentCheckInsByDay[index];
      point.count += 1;
      point.entities.push({
        id: attendance.id,
        name: parent,
        link: {
          kind: 'parent' as ReportEntityLink['kind'],
          parentId: attendance.parent?.id,
          sessionId: checkIn.session.id,
        },
        meta: { parent, sessionDate, loggedBy: recordedBy },
      });
    }
  }

  const completions = (formsResult.data ?? []) as unknown as FormCompletionRow[];
  const completionTypes = new Map<string, ReportDataPoint[]>();
  for (const completion of completions) {
    const type = completion.form?.purpose || 'other';
    const series = completionTypes.get(type) ?? emptySeries(days);
    completionTypes.set(type, series);
    const index = indexByDate.get(dateKey(completion.submitted_at));
    if (index === undefined) continue;
    const formName = completion.form?.name ?? 'Unknown form';
    const point = series[index];
    point.count += 1;
    point.entities.push({
      id: completion.id,
      name: formName,
      link: { kind: 'form', formId: completion.form_id },
      meta: {
        form: formName,
        purpose: formatTypeLabel(type),
        submittedAt: format(new Date(completion.submitted_at), 'd MMM yyyy, h:mm a'),
        loggedBy: completion.recordedBy
          ? personName(completion.recordedBy, 'Unknown staff')
          : undefined,
      },
    });
  }

  return {
    staffCheckInsByDay,
    studentCheckInsByDay,
    parentCheckInsByDay,
    formCompletionsByType: [...completionTypes.entries()]
      .map(([type, data]) => ({ type, label: formatTypeLabel(type), data }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

