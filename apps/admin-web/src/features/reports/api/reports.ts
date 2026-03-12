import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BillingStatsReportData,
  IssuesReportData,
  MarketingStatsReportData,
  ProjectsReportData,
  ReportDataPoint,
  ReportEntityLink,
  RevenueReportDataPoint,
  StaffAbsencesReportData,
  StudentStatsReportData,
  TasksReportData,
} from '../types';
import {
  eachDayOfInterval,
  format,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { calculateSessionPrice } from '@/shared/utils/pricing';
import type { StudentSubsidyRow } from '@/features/students/api/subsidies';
import { pricingApi } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi } from '@/features/billing/api/subject-pricing-overrides';

type IssueRow = {
  id: string;
  name: string;
  created_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_by_staff: { first_name: string | null; last_name: string | null } | null;
};

type StaffSessionRow = {
  id: string;
  staff_id: string;
  staff_first_name: string | null;
  staff_last_name: string | null;
  session_id: string;
  session_start_at: string | null;
  planned_absence: boolean;
  planned_absence_logged_at: string | null;
  is_swapped: boolean;
  swapped_sessions_staff_id: string | null;
  swapped_staff_first_name: string | null;
  swapped_staff_last_name: string | null;
  class_short_name: string | null;
  logged_by_first_name: string | null;
  logged_by_last_name: string | null;
};

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  active_at: string | null;
  registered_at: string | null;
};

type ClassRow = Tables<'classes'> & {
  subject?: Tables<'subjects'> | null;
};

type ClassEnrollmentRow = {
  id: string;
  class_id: string;
  class_name: string | null;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  enrolled_at: string;
  unenrolled_at: string | null;
  enrolled_by_staff: { first_name: string | null; last_name: string | null } | null;
  unenrolled_by_staff: { first_name: string | null; last_name: string | null } | null;
};

type SessionStudentRow = {
  id: string;
  session_id: string;
  session_start_at: string | null;
  class_short_name: string | null;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  planned_absence: boolean;
  planned_absence_logged_at: string | null;
  planned_absence_logged_by_staff: { first_name: string | null; last_name: string | null } | null;
  is_credited: boolean;
  credited_at: string | null;
  is_rescheduled: boolean;
  rescheduled_at: string | null;
};

type InvoiceRow = {
  id: string;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  invoice_date: string;
  amount_due_cents: number;
  fee_cents: number | null;
  is_refunded: boolean;
  refunded_at: string | null;
  voided_at: string | null;
};

type CreditNoteRow = {
  id: string;
  invoice_id: string;
  amount_cents: number;
  reason: string | null;
  created_at: string;
};

type CreditBalanceTransactionRow = {
  id: string;
  invoice_id: string | null;
  stripe_customer_id: string | null;
  type: string | null;
  amount_cents: number;
  currency: string;
  effective_at: string;
};

type PredictedRevenueSessionRow = {
  id: string;
  session_id: string;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  planned_absence: boolean;
  session: {
    start_at: string;
    end_at: string;
    subject_id: string | null;
    billing_type: string | null;
  };
};

function toDateOnlyString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function formatMetaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy');
}

function formatMetaDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return format(d, 'd MMM yyyy, h:mm a');
}

function staffName(first: string | null, last: string | null, fallback: string): string {
  const n = [first, last].filter(Boolean).join(' ').trim();
  return n || fallback;
}

function buildEmptySeries(days: Date[]): ReportDataPoint[] {
  return days.map((day) => ({
    date: toDateOnlyString(day),
    count: 0,
    entities: [],
  }));
}

function buildEmptyRevenueSeries(days: Date[]): RevenueReportDataPoint[] {
  return days.map((day) => ({
    date: toDateOnlyString(day),
    count: 0,
    entities: [],
    amountCents: 0,
  }));
}

/**
 * Fetch issues relevant for reports in the given date range.
 * Returns issues created before/during the week or resolved during the week.
 */
async function fetchIssuesForReport(
  weekStart: Date,
  weekEnd: Date
): Promise<IssueRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const weekEndIso = weekEnd.toISOString();

  const { data, error } = await supabase
    .from('issues')
    .select(
      'id, name, created_at, resolved_at, created_by, created_by_staff:staff!issues_created_by_fkey(id, first_name, last_name)'
    )
    .lte('created_at', weekEndIso);

  if (error) throw error;

  type RawRow = {
    id: string;
    name: string;
    created_at: string | null;
    resolved_at: string | null;
    created_by: string | null;
    created_by_staff: { id: string; first_name: string | null; last_name: string | null } | null;
  };
  const rows = (data ?? []) as RawRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    created_by: r.created_by,
    created_by_staff: r.created_by_staff,
  }));
}

/**
 * Compute open issues at end of each day in the range.
 * Open = created_at <= end_of_day AND (resolved_at IS NULL OR resolved_at > end_of_day)
 */
function computeOpenByDay(
  issues: IssueRow[],
  days: Date[]
): ReportDataPoint[] {
  return days.map((day) => {
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const openIssues = issues.filter((issue) => {
      const createdAt = issue.created_at ? new Date(issue.created_at) : null;
      if (!createdAt || isAfter(createdAt, dayEnd)) return false;

      if (!issue.resolved_at) return true;
      const resolvedAt = new Date(issue.resolved_at);
      return isAfter(resolvedAt, dayEnd);
    });

    return {
      date: dayStr,
      count: openIssues.length,
      entities: openIssues.map((i) => ({
        id: i.id,
        name: i.name,
        link: { kind: 'issue' as ReportEntityLink['kind'] },
        meta: {
          createdBy: i.created_by_staff
            ? staffName(i.created_by_staff.first_name, i.created_by_staff.last_name, '')
            : undefined,
        },
      })),
    };
  });
}

/**
 * Compute resolved issues per day in the range.
 */
function computeResolvedByDay(
  issues: IssueRow[],
  days: Date[]
): ReportDataPoint[] {
  return days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const resolvedIssues = issues.filter((issue) => {
      if (!issue.resolved_at) return false;
      const resolvedAt = new Date(issue.resolved_at);
      return !isBefore(resolvedAt, dayStart) && !isAfter(resolvedAt, dayEnd);
    });

    return {
      date: dayStr,
      count: resolvedIssues.length,
      entities: resolvedIssues.map((i) => ({
        id: i.id,
        name: i.name,
        link: { kind: 'issue' as ReportEntityLink['kind'] },
        meta: {
          createdBy: i.created_by_staff
            ? staffName(i.created_by_staff.first_name, i.created_by_staff.last_name, '')
            : undefined,
          resolvedAt: formatMetaDate(i.resolved_at),
        },
      })),
    };
  });
}

/**
 * Fetch and compute issues report data for a week.
 */
export async function fetchIssuesReportData(
  weekStart: Date,
  weekEnd: Date
): Promise<IssuesReportData> {
  const issues = await fetchIssuesForReport(weekStart, weekEnd);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return {
    openByDay: computeOpenByDay(issues, days),
    resolvedByDay: computeResolvedByDay(issues, days),
  };
}

type TaskRow = {
  id: string;
  title: string;
  created_at: string | null;
  completed_at: string | null;
  created_by_staff: { first_name: string | null; last_name: string | null } | null;
  assigned_to_staff: { first_name: string | null; last_name: string | null } | null;
};

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  completed_at: string | null;
  created_by_staff: { first_name: string | null; last_name: string | null } | null;
  project_lead_staff: { first_name: string | null; last_name: string | null } | null;
};

/**
 * Fetch tasks relevant for reports: created before or during the period,
 * or completed during the period.
 */
async function fetchTasksForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<TaskRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const periodEndIso = endOfDay(periodEnd).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, title, created_at, completed_at, created_by_staff:staff!tasks_created_by_fkey(first_name, last_name), assigned_to_staff:staff!tasks_assigned_to_fkey(first_name, last_name)'
    )
    .lte('created_at', periodEndIso);

  if (error) throw error;

  type RawRow = {
    id: string;
    title: string;
    created_at: string | null;
    completed_at: string | null;
    created_by_staff: { first_name: string | null; last_name: string | null } | null;
    assigned_to_staff: { first_name: string | null; last_name: string | null } | null;
  };
  return (data ?? []) as RawRow[];
}

/**
 * Open tasks at end of each day: created_at <= end_of_day AND (completed_at IS NULL OR completed_at > end_of_day)
 */
function computeOpenTasksByDay(
  tasks: TaskRow[],
  days: Date[]
): ReportDataPoint[] {
  return days.map((day) => {
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const openTasks = tasks.filter((task) => {
      const createdAt = task.created_at ? new Date(task.created_at) : null;
      if (!createdAt || isAfter(createdAt, dayEnd)) return false;
      if (!task.completed_at) return true;
      const completedAt = new Date(task.completed_at);
      return isAfter(completedAt, dayEnd);
    });

    return {
      date: dayStr,
      count: openTasks.length,
      entities: openTasks.map((t) => ({
        id: t.id,
        name: t.title,
        link: { kind: 'task' as ReportEntityLink['kind'], taskId: t.id },
        meta: {
          createdBy: t.created_by_staff
            ? staffName(t.created_by_staff.first_name, t.created_by_staff.last_name, '')
            : undefined,
          assignee: t.assigned_to_staff
            ? staffName(t.assigned_to_staff.first_name, t.assigned_to_staff.last_name, '')
            : undefined,
        },
      })),
    };
  });
}

/**
 * Completed tasks per day (completed_at within the day).
 */
function computeCompletedTasksByDay(
  tasks: TaskRow[],
  days: Date[]
): ReportDataPoint[] {
  return days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const completedTasks = tasks.filter((task) => {
      if (!task.completed_at) return false;
      const completedAt = new Date(task.completed_at);
      return !isBefore(completedAt, dayStart) && !isAfter(completedAt, dayEnd);
    });

    return {
      date: dayStr,
      count: completedTasks.length,
      entities: completedTasks.map((t) => ({
        id: t.id,
        name: t.title,
        link: { kind: 'task' as ReportEntityLink['kind'], taskId: t.id },
        meta: {
          createdBy: t.created_by_staff
            ? staffName(t.created_by_staff.first_name, t.created_by_staff.last_name, '')
            : undefined,
          assignee: t.assigned_to_staff
            ? staffName(t.assigned_to_staff.first_name, t.assigned_to_staff.last_name, '')
            : undefined,
          completedAt: formatMetaDateTime(t.completed_at),
        },
      })),
    };
  });
}

export async function fetchTasksReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<TasksReportData> {
  const tasks = await fetchTasksForReport(periodStart, periodEnd);
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  return {
    openByDay: computeOpenTasksByDay(tasks, days),
    completedByDay: computeCompletedTasksByDay(tasks, days),
  };
}

/**
 * Fetch projects relevant for reports (created before/during period or completed during period).
 */
async function fetchProjectsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<ProjectRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const periodEndIso = endOfDay(periodEnd).toISOString();

  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, name, created_at, completed_at, created_by_staff:staff!projects_created_by_fkey(first_name, last_name), project_lead_staff:staff!projects_project_lead_id_fkey(first_name, last_name)'
    )
    .lte('created_at', periodEndIso);

  if (error) throw error;

  type RawRow = {
    id: string;
    name: string;
    created_at: string;
    completed_at: string | null;
    created_by_staff: { first_name: string | null; last_name: string | null } | null;
    project_lead_staff: { first_name: string | null; last_name: string | null } | null;
  };
  return (data ?? []) as RawRow[];
}

/**
 * Open projects at end of each day: created_at <= end_of_day AND (completed_at IS NULL OR completed_at > end_of_day)
 */
function computeOpenProjectsByDay(
  projects: ProjectRow[],
  days: Date[]
): ReportDataPoint[] {
  return days.map((day) => {
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const openProjects = projects.filter((proj) => {
      const createdAt = new Date(proj.created_at);
      if (isAfter(createdAt, dayEnd)) return false;
      if (!proj.completed_at) return true;
      const completedAt = new Date(proj.completed_at);
      return isAfter(completedAt, dayEnd);
    });

    return {
      date: dayStr,
      count: openProjects.length,
      entities: openProjects.map((p) => ({
        id: p.id,
        name: p.name,
        link: { kind: 'project' as ReportEntityLink['kind'], projectId: p.id },
        meta: {
          createdBy: p.created_by_staff
            ? staffName(p.created_by_staff.first_name, p.created_by_staff.last_name, '')
            : undefined,
          projectLead: p.project_lead_staff
            ? staffName(p.project_lead_staff.first_name, p.project_lead_staff.last_name, '')
            : undefined,
        },
      })),
    };
  });
}

export async function fetchProjectsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<ProjectsReportData> {
  const projects = await fetchProjectsForReport(periodStart, periodEnd);
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  return {
    openByDay: computeOpenProjectsByDay(projects, days),
  };
}

/**
 * STAFF STATS
 *
 * Number of staff absences logged within a time period.
 */
async function fetchStaffSessionsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<StaffSessionRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('sessions_staff')
    .select(
      `
      id, staff_id, session_id, planned_absence, planned_absence_logged_at, is_swapped, swapped_sessions_staff_id,
      staff:staff!sessions_staff_staff_id_fkey(first_name, last_name),
      session:sessions!sessions_staff_session_id_fkey(start_at, classes!sessions_class_id_fkey(short_name, day_of_week, start_time, subject:subjects(id, long_name, short_name))),
      logged_by_staff:staff!sessions_staff_planned_absence_logged_by_fkey(first_name, last_name)
    `
    )
    .gte('planned_absence_logged_at', startIso)
    .lte('planned_absence_logged_at', endIso)
    .eq('planned_absence', true);

  if (error) throw error;

  type RawRow = {
    id: string;
    staff_id: string;
    session_id: string;
    planned_absence: boolean;
    planned_absence_logged_at: string | null;
    is_swapped: boolean;
    swapped_sessions_staff_id: string | null;
    staff: { first_name: string | null; last_name: string | null } | null;
    session: {
      start_at: string | null;
      classes: {
        short_name: string | null;
        day_of_week: number | null;
        start_time: string | null;
        subject: { id: string; long_name: string | null; short_name: string | null } | null;
      } | null;
    } | null;
    logged_by_staff: { first_name: string | null; last_name: string | null } | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => {
    const cls = row.session?.classes;
    const classShortName = cls?.short_name?.trim() ?? null;

    return {
      id: row.id,
      staff_id: row.staff_id,
      staff_first_name: row.staff?.first_name ?? null,
      staff_last_name: row.staff?.last_name ?? null,
      session_id: row.session_id,
      session_start_at: row.session?.start_at ?? null,
      planned_absence: row.planned_absence,
      planned_absence_logged_at: row.planned_absence_logged_at,
      is_swapped: row.is_swapped,
      swapped_sessions_staff_id: row.swapped_sessions_staff_id,
      swapped_staff_first_name: null,
      swapped_staff_last_name: null,
      class_short_name: classShortName,
      logged_by_first_name: row.logged_by_staff?.first_name ?? null,
      logged_by_last_name: row.logged_by_staff?.last_name ?? null,
    };
  });
}

export async function fetchStaffAbsencesReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<StaffAbsencesReportData> {
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const sessions = await fetchStaffSessionsForReport(periodStart, periodEnd);

  const byDay = buildEmptySeries(days);

  const indexByDate = new Map<string, number>();
  byDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  sessions.forEach((row) => {
    if (!row.planned_absence_logged_at) return;
    const loggedAt = new Date(row.planned_absence_logged_at);
    const dayStr = toDateOnlyString(loggedAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const staffNameStr =
      row.staff_first_name || row.staff_last_name
        ? `${row.staff_first_name ?? ''} ${row.staff_last_name ?? ''}`.trim()
        : row.staff_id;
    const sessionTime = row.session_start_at
      ? new Date(row.session_start_at).toLocaleTimeString('en-AU', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

    const descriptionParts = [
      staffNameStr,
      sessionTime ? `Session at ${sessionTime}` : `Session ${row.session_id}`,
    ];
    if (row.is_swapped) {
      descriptionParts.push('swapped');
      const swappedName =
        row.swapped_staff_first_name || row.swapped_staff_last_name
          ? `${row.swapped_staff_first_name ?? ''} ${
              row.swapped_staff_last_name ?? ''
            }`.trim()
          : row.swapped_sessions_staff_id;
      if (swappedName) {
        descriptionParts.push(`with ${swappedName}`);
      }
    } else {
      descriptionParts.push('not swapped');
    }

    const entityName = descriptionParts.join(' · ');

    const point = byDay[index];
    point.count += 1;
    point.entities = [
      ...point.entities,
      {
        id: row.id,
        name: entityName,
        link: {
          kind: 'staff',
          staffId: row.staff_id,
          sessionId: row.session_id,
        },
        meta: {
          staff: staffNameStr,
          class: row.class_short_name ?? undefined,
          absenceDate: formatMetaDate(row.planned_absence_logged_at),
          loggedBy:
            row.logged_by_first_name || row.logged_by_last_name
              ? staffName(row.logged_by_first_name, row.logged_by_last_name, '')
              : undefined,
        },
      },
    ];
  });

  return {
    absencesByDay: byDay,
  };
}

/**
 * STUDENT STATS
 */
async function fetchStudentsForReport(): Promise<StudentRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, status, active_at, registered_at');

  if (error) throw error;
  return (data ?? []) as StudentRow[];
}

async function fetchClassesForReport(): Promise<ClassRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('classes')
    .select(
      `
      *,
      subject:subjects(*)
    `
    );

  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

async function fetchClassEnrollmentsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<ClassEnrollmentRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('classes_students')
    .select(
      `
      id,
      class_id,
      class:classes(short_name, level, day_of_week, start_time, subject:subjects(id, long_name, short_name)),
      student_id,
      student:students(first_name, last_name),
      enrolled_at,
      unenrolled_at,
      enrolled_by_staff:staff!classes_students_enrolled_by_fkey(first_name, last_name),
      unenrolled_by_staff:staff!classes_students_unenrolled_by_fkey(first_name, last_name)
    `
    )
    .or(`and(enrolled_at.gte.${startIso},enrolled_at.lte.${endIso}),and(unenrolled_at.gte.${startIso},unenrolled_at.lte.${endIso})`);

  if (error) throw error;

  type RawRow = {
    id: string;
    class_id: string;
    class: {
      short_name: string | null;
      level: string | null;
      day_of_week: number | null;
      start_time: string | null;
      subject: { id: string; long_name: string | null; short_name: string | null } | null;
    } | null;
    student_id: string;
    student: { first_name: string | null; last_name: string | null } | null;
    enrolled_at: string;
    unenrolled_at: string | null;
    enrolled_by_staff: { first_name: string | null; last_name: string | null } | null;
    unenrolled_by_staff: { first_name: string | null; last_name: string | null } | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => {
    const cls = row.class;
    const classShortName =
      cls?.short_name?.trim() ?? row.class?.level ?? null;

    return {
      id: row.id,
      class_id: row.class_id,
      class_name: classShortName,
      student_id: row.student_id,
      student_first_name: row.student?.first_name ?? null,
      student_last_name: row.student?.last_name ?? null,
      enrolled_at: row.enrolled_at,
      unenrolled_at: row.unenrolled_at,
      enrolled_by_staff: row.enrolled_by_staff,
      unenrolled_by_staff: row.unenrolled_by_staff,
    };
  });
}

async function fetchStudentSessionsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<SessionStudentRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('sessions_students')
    .select(
      `
      id,
      session_id,
      session:sessions!sessions_students_session_id_fkey(start_at, class:classes(short_name, day_of_week, start_time, subject:subjects(id, long_name, short_name))),
      student_id,
      student:students(first_name, last_name),
      planned_absence,
      planned_absence_logged_at,
      planned_absence_logged_by_staff:staff!sessions_students_planned_absence_logged_by_fkey(first_name, last_name),
      is_credited,
      credited_at,
      is_rescheduled,
      rescheduled_at
    `
    )
    .or(
      [
        `and(planned_absence_logged_at.gte.${startIso},planned_absence_logged_at.lte.${endIso})`,
        `and(credited_at.gte.${startIso},credited_at.lte.${endIso})`,
        `and(rescheduled_at.gte.${startIso},rescheduled_at.lte.${endIso})`,
      ].join(',')
    );

  if (error) throw error;

  type RawRow = {
    id: string;
    session_id: string;
    session: {
      start_at: string | null;
      class: {
        short_name: string | null;
        day_of_week: number | null;
        start_time: string | null;
        subject: { id: string; long_name: string | null; short_name: string | null } | null;
      } | null;
    } | null;
    student_id: string;
    student: { first_name: string | null; last_name: string | null } | null;
    planned_absence: boolean;
    planned_absence_logged_at: string | null;
    planned_absence_logged_by_staff: { first_name: string | null; last_name: string | null } | null;
    is_credited: boolean;
    credited_at: string | null;
    is_rescheduled: boolean;
    rescheduled_at: string | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => {
    const cls = row.session?.class;
    const classShortName = cls?.short_name?.trim() ?? null;

    return {
      id: row.id,
      session_id: row.session_id,
      session_start_at: row.session?.start_at ?? null,
      class_short_name: classShortName,
      student_id: row.student_id,
      student_first_name: row.student?.first_name ?? null,
      student_last_name: row.student?.last_name ?? null,
      planned_absence: row.planned_absence,
      planned_absence_logged_at: row.planned_absence_logged_at,
      planned_absence_logged_by_staff: row.planned_absence_logged_by_staff,
      is_credited: row.is_credited,
      credited_at: row.credited_at,
      is_rescheduled: row.is_rescheduled,
      rescheduled_at: row.rescheduled_at,
    };
  });
}

export async function fetchStudentStatsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<StudentStatsReportData> {
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const [students, classes, classEnrollments, sessionStudents] = await Promise.all([
    fetchStudentsForReport(),
    fetchClassesForReport(),
    fetchClassEnrollmentsForReport(periodStart, periodEnd),
    fetchStudentSessionsForReport(periodStart, periodEnd),
  ]);

  // Active students
  const activeStudentsByDay = days.map((day) => {
    const dayEnd = endOfDay(day);
    const dayStr = toDateOnlyString(day);

    const active = students.filter((student) => {
      if (student.status !== 'ACTIVE') return false;
      const activeAt = student.active_at ? new Date(student.active_at) : null;
      if (!activeAt || isAfter(activeAt, dayEnd)) return false;
      return true;
    });

    return {
      date: dayStr,
      count: active.length,
      entities: active.map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        link: {
          kind: 'student' as ReportEntityLink['kind'],
          studentId: s.id,
        },
      })),
    };
  });

  // Active classes
  const activeClassesByDay = days.map((day) => {
    const dayOnly = startOfDay(day);
    const dayStr = toDateOnlyString(day);

    const activeClasses = classes.filter((cls) => {
      if (!cls.session_start_date || !cls.session_end_date) return false;
      const start = new Date(cls.session_start_date);
      const end = new Date(cls.session_end_date);
      return !isAfter(start, dayOnly) && !isBefore(end, dayOnly);
    });

    return {
      date: dayStr,
      count: activeClasses.length,
      entities: activeClasses.map((cls) => ({
        id: cls.id,
        name: cls.short_name?.trim() ?? `Class ${cls.id}`,
        link: {
          kind: 'class' as ReportEntityLink['kind'],
          classId: cls.id,
        },
      })),
    };
  });

  const enrolmentsByDay = buildEmptySeries(days);
  const unenrolmentsByDay = buildEmptySeries(days);
  const absencesByDay = buildEmptySeries(days);

  const indexByDate = new Map<string, number>();
  enrolmentsByDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  // Enrolments / unenrolments
  const getClassShortName = (classId: string): string => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return classId ? `Class ${classId}` : 'Class';
    return cls.short_name?.trim() ?? `Class ${classId}`;
  };

  classEnrollments.forEach((row) => {
    const enrolDate = new Date(row.enrolled_at);
    const enrolDayStr = toDateOnlyString(enrolDate);
    const enrolIndex = indexByDate.get(enrolDayStr);
    if (enrolIndex !== undefined) {
      const studentName =
        row.student_first_name || row.student_last_name
          ? `${row.student_first_name ?? ''} ${
              row.student_last_name ?? ''
            }`.trim()
          : row.student_id;
      const className = getClassShortName(row.class_id);

      const enrolPoint = enrolmentsByDay[enrolIndex];
      enrolPoint.count += 1;
      enrolPoint.entities = [
        ...enrolPoint.entities,
        {
          id: row.id,
          name: `${studentName} → ${className}`,
          link: {
            kind: 'enrolment',
            studentId: row.student_id,
            classId: row.class_id,
          },
          meta: {
            class: className,
            student: studentName,
            enrolledAt: formatMetaDate(row.enrolled_at),
            enrolledBy: row.enrolled_by_staff
              ? staffName(row.enrolled_by_staff.first_name, row.enrolled_by_staff.last_name, '')
              : undefined,
          },
        },
      ];
    }

    if (row.unenrolled_at) {
      const unenrolDate = new Date(row.unenrolled_at);
      const unenrolDayStr = toDateOnlyString(unenrolDate);
      const unenrolIndex = indexByDate.get(unenrolDayStr);
      if (unenrolIndex !== undefined) {
        const studentName =
          row.student_first_name || row.student_last_name
            ? `${row.student_first_name ?? ''} ${
                row.student_last_name ?? ''
              }`.trim()
            : row.student_id;
        const className = getClassShortName(row.class_id);

        const unenrolPoint = unenrolmentsByDay[unenrolIndex];
        unenrolPoint.count += 1;
        unenrolPoint.entities = [
          ...unenrolPoint.entities,
          {
            id: row.id,
            name: `${studentName} unenrolled from ${className}`,
            link: {
              kind: 'unenrolment',
              studentId: row.student_id,
              classId: row.class_id,
            },
            meta: {
              class: className,
              student: studentName,
              unenrolledAt: formatMetaDate(row.unenrolled_at),
              unenrolledBy: row.unenrolled_by_staff
                ? staffName(row.unenrolled_by_staff.first_name, row.unenrolled_by_staff.last_name, '')
                : undefined,
            },
          },
        ];
      }
    }
  });

  // Student absences (credited / rescheduled)
  sessionStudents.forEach((row) => {
    const dateSources: Array<{ at: string | null; label: string }> = [
      { at: row.planned_absence_logged_at, label: 'absence' },
      { at: row.credited_at, label: 'credited' },
      { at: row.rescheduled_at, label: 'rescheduled' },
    ];

    dateSources.forEach(({ at }) => {
      if (!at) return;
      const dt = new Date(at);
      const dayStr = toDateOnlyString(dt);
      const index = indexByDate.get(dayStr);
      if (index === undefined) return;

      const tags: string[] = [];
      if (row.planned_absence) {
        tags.push('absent');
      }
      if (row.is_credited) {
        tags.push('credited');
      }
      if (row.is_rescheduled) {
        tags.push('rescheduled');
      }

      const studentName =
        row.student_first_name || row.student_last_name
          ? `${row.student_first_name ?? ''} ${
              row.student_last_name ?? ''
            }`.trim()
          : row.student_id;

      const timeLabel = row.session_start_at
        ? new Date(row.session_start_at).toLocaleTimeString('en-AU', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : null;

      const point = absencesByDay[index];
      point.count += 1;
      point.entities = [
        ...point.entities,
        {
          id: row.id,
          name: `${studentName} · ${timeLabel ? `Session at ${timeLabel}` : `Session ${row.session_id}`} · ${tags.join(
            ', '
          )}`,
          link: {
            kind: 'absence' as ReportEntityLink['kind'],
            sessionId: row.session_id,
            studentId: row.student_id,
          },
          meta: {
            student: studentName,
            class: row.class_short_name ?? undefined,
            absenceDate: formatMetaDate(at),
            loggedBy: row.planned_absence_logged_by_staff
              ? staffName(row.planned_absence_logged_by_staff.first_name, row.planned_absence_logged_by_staff.last_name, '')
              : undefined,
          },
        },
      ];
    });
  });

  return {
    activeStudentsByDay,
    activeClassesByDay,
    enrolmentsByDay,
    unenrolmentsByDay,
    absencesByDay,
  };
}

/**
 * MARKETING STATS
 */
export async function fetchMarketingStatsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketingStatsReportData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const [registrationsResult, discontinuationsResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, registered_at')
      .gte('registered_at', startIso)
      .lte('registered_at', endIso),
    supabase
      .from('students')
      .select('id, first_name, last_name, discontinued_at')
      .gte('discontinued_at', startIso)
      .lte('discontinued_at', endIso),
  ]);

  if (registrationsResult.error) throw registrationsResult.error;
  if (discontinuationsResult.error) throw discontinuationsResult.error;

  const registeredStudents = (registrationsResult.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    registered_at: string | null;
  }>;

  const discontinuedStudents = (discontinuationsResult.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    discontinued_at: string | null;
  }>;

  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const registrationsByDay = buildEmptySeries(days);
  const discontinuationsByDay = buildEmptySeries(days);
  const indexByDate = new Map<string, number>();
  registrationsByDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  registeredStudents.forEach((student) => {
    if (!student.registered_at) return;
    const registeredAt = new Date(student.registered_at);
    const dayStr = toDateOnlyString(registeredAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const point = registrationsByDay[index];
    point.count += 1;
    point.entities = [
      ...point.entities,
      {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        link: {
          kind: 'registration',
          studentId: student.id,
        },
        meta: {
          student: `${student.first_name} ${student.last_name}`,
          registeredAt: formatMetaDate(student.registered_at),
        },
      },
    ];
  });

  discontinuedStudents.forEach((student) => {
    if (!student.discontinued_at) return;
    const discontinuedAt = new Date(student.discontinued_at);
    const dayStr = toDateOnlyString(discontinuedAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const point = discontinuationsByDay[index];
    point.count += 1;
    point.entities = [
      ...point.entities,
      {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        link: {
          kind: 'student',
          studentId: student.id,
        },
        meta: {
          student: `${student.first_name} ${student.last_name}`,
          discontinuedAt: formatMetaDate(student.discontinued_at),
        },
      },
    ];
  });

  return {
    registrationsByDay,
    discontinuationsByDay,
  };
}

/**
 * BILLING STATS
 */
async function fetchInvoicesForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<InvoiceRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = toDateOnlyString(periodStart);
  const endIso = toDateOnlyString(periodEnd);

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `
      id,
      student_id,
      student:students(first_name, last_name),
      invoice_date,
      amount_due_cents,
      fee_cents,
      is_refunded,
      refunded_at,
      voided_at
    `
    )
    .gte('invoice_date', startIso)
    .lte('invoice_date', endIso);

  if (error) throw error;

  type RawRow = {
    id: string;
    student_id: string;
    student: { first_name: string | null; last_name: string | null } | null;
    invoice_date: string;
    amount_due_cents: number;
    fee_cents: number | null;
    is_refunded: boolean;
    refunded_at: string | null;
    voided_at: string | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => ({
    id: row.id,
    student_id: row.student_id,
    student_first_name: row.student?.first_name ?? null,
    student_last_name: row.student?.last_name ?? null,
    invoice_date: row.invoice_date,
    amount_due_cents: row.amount_due_cents,
    fee_cents: row.fee_cents,
    is_refunded: row.is_refunded,
    refunded_at: row.refunded_at,
    voided_at: row.voided_at,
  }));
}

/**
 * Fetch sessions_students for predicted revenue: sessions occurring in the period
 * where the student does NOT have a planned absence.
 */
async function fetchSessionsStudentsForPredictedRevenue(
  periodStart: Date,
  periodEnd: Date
): Promise<PredictedRevenueSessionRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = startOfDay(periodStart).toISOString();
  const endIso = endOfDay(periodEnd).toISOString();

  // Fetch sessions in date range first
  const { data: sessionsData, error: sessErr } = await supabase
    .from('sessions')
    .select('id, start_at, end_at, subject_id, billing_type')
    .gte('start_at', startIso)
    .lte('start_at', endIso);

  if (sessErr) throw sessErr;
  const sessions = (sessionsData ?? []) as Array<{
    id: string;
    start_at: string;
    end_at: string;
    subject_id: string | null;
    billing_type: string | null;
  }>;

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Fetch sessions_students (excluding planned absences) for those sessions
  const { data: ssData, error: ssErr } = await supabase
    .from('sessions_students')
    .select('id, session_id, student_id, planned_absence, student:students(first_name, last_name)')
    .in('session_id', sessionIds)
    .eq('planned_absence', false);

  if (ssErr) throw ssErr;

  type SsRawRow = {
    id: string;
    session_id: string;
    student_id: string;
    planned_absence: boolean;
    student: { first_name: string | null; last_name: string | null } | null;
  };
  const ssRows = (ssData ?? []) as SsRawRow[];

  return ssRows
    .map((row) => {
      const session = sessionById.get(row.session_id);
      if (!session) return null;
      return {
        id: row.id,
        session_id: row.session_id,
        student_id: row.student_id,
        student_first_name: row.student?.first_name ?? null,
        student_last_name: row.student?.last_name ?? null,
        planned_absence: row.planned_absence,
        session: {
          start_at: session.start_at,
          end_at: session.end_at,
          subject_id: session.subject_id,
          billing_type: session.billing_type,
        },
      };
    })
    .filter((r): r is PredictedRevenueSessionRow => r !== null);
}

type SubsidyRow = {
  student_id: string;
  subject_id: string;
  billing_type: string;
  price_cents: number;
  currency: string | null;
  effective_from: string | null;
  effective_until: string | null;
};

type EnrollmentWithSubjectRow = {
  student_id: string;
  subject_id: string;
  class_id: string;
  enrolled_at: string;
  unenrolled_at: string | null;
  class_short_name: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
};

/**
 * Fetch class enrollments that overlap the period, with subject and class details.
 * Used to determine which (student_id, subject_id) pairs are enrolled on a given day.
 */
async function fetchEnrollmentsWithSubjectForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<EnrollmentWithSubjectRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('classes_students')
    .select(
      'student_id, class_id, enrolled_at, unenrolled_at, class:classes(short_name, day_of_week, start_time, subject:subjects(id, long_name, short_name)), student:students(first_name, last_name)'
    )
    .lte('enrolled_at', endIso)
    .or(`unenrolled_at.is.null,unenrolled_at.gte.${startIso}`);

  if (error) throw error;

  type RawRow = {
    student_id: string;
    class_id: string;
    enrolled_at: string;
    unenrolled_at: string | null;
    class: {
      short_name: string | null;
      day_of_week: number | null;
      start_time: string | null;
      subject: { id: string; long_name: string | null; short_name: string | null } | null;
    } | null;
    student: { first_name: string | null; last_name: string | null } | null;
  };

  const rows = (data ?? []) as RawRow[];
  return rows
    .filter((row): row is RawRow & { class: { subject: NonNullable<RawRow['class']>['subject'] } } =>
      row.class?.subject != null
    )
    .map((row) => {
      const cls = row.class!;
      const subject = cls.subject!;
      const classShortName = cls.short_name?.trim() ?? null;
      return {
        student_id: row.student_id,
        subject_id: subject.id,
        class_id: row.class_id,
        enrolled_at: row.enrolled_at,
        unenrolled_at: row.unenrolled_at,
        class_short_name: classShortName,
        student_first_name: row.student?.first_name ?? null,
        student_last_name: row.student?.last_name ?? null,
      };
    });
}

async function fetchSubsidiesForReport(): Promise<SubsidyRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('student_subsidies')
    .select('student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until');

  if (error) throw error;
  return (data ?? []) as SubsidyRow[];
}

async function fetchCreditNotesForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<CreditNoteRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('credit_notes')
    .select(
      'id, invoice_id, amount_cents, reason, created_at, refund_amount_cents, credit_amount_cents, out_of_band_amount_cents'
    )
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) throw error;
  // Cast via unknown to avoid Supabase's extended error typing when selecting new columns
  return (data ?? []) as unknown as CreditNoteRow[];
}

async function fetchCreditBalanceTransactionsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<CreditBalanceTransactionRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('credit_balance_transactions')
    .select(
      'id, invoice_id, stripe_customer_id, type, amount_cents, currency, effective_at'
    )
    .gte('effective_at', startIso)
    .lte('effective_at', endIso);

  if (error) throw error;
  return (data ?? []) as CreditBalanceTransactionRow[];
}

export async function fetchBillingStatsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<BillingStatsReportData> {
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const [
    invoices,
    sessionsStudents,
    creditNotes,
    creditBalanceTransactions,
    billingPricing,
    pricingOverrides,
    subsidies,
    enrollmentsWithSubject,
  ] = await Promise.all([
    fetchInvoicesForReport(periodStart, periodEnd),
    fetchSessionsStudentsForPredictedRevenue(periodStart, periodEnd),
    fetchCreditNotesForReport(periodStart, periodEnd),
    fetchCreditBalanceTransactionsForReport(periodStart, periodEnd),
    pricingApi.getBillingPricing(),
    subjectPricingOverridesApi.getAllSubjectOverrides(),
    fetchSubsidiesForReport(),
    fetchEnrollmentsWithSubjectForReport(periodStart, periodEnd),
  ]);

  const predictedRevenueByDay = buildEmptyRevenueSeries(days);
  const actualRevenueByDay = buildEmptyRevenueSeries(days);
  const refundsByDay = buildEmptySeries(days);
  const creditsByDay = buildEmptyRevenueSeries(days);
  const voidedInvoicesByDay = buildEmptySeries(days);
  const subsidiesEnrolledByDay = buildEmptySeries(days);

  const indexByDate = new Map<string, number>();
  predictedRevenueByDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  // Build pricing lookup structures (mirror billing-runner)
  const pricingByBillingType: Record<
    string,
    { hourly_rate_cents: number; currency: string }
  > = {};
  for (const p of billingPricing) {
    pricingByBillingType[p.billing_type] = {
      hourly_rate_cents: p.hourly_rate_cents,
      currency: p.currency,
    };
  }

  const overridesBySubjectAndBilling: Record<
    string,
    Record<string, { hourly_rate_cents: number; currency: string }>
  > = {};
  for (const o of pricingOverrides) {
    if (!overridesBySubjectAndBilling[o.subject_id]) {
      overridesBySubjectAndBilling[o.subject_id] = {};
    }
    overridesBySubjectAndBilling[o.subject_id][o.billing_type] = {
      hourly_rate_cents: o.hourly_rate_cents,
      currency: o.currency,
    };
  }

  // Predicted revenue: sessions occurring on each day × calculated price per student
  // Only billable sessions (billing_type + subject_id) contribute to revenue
  sessionsStudents.forEach((row) => {
    const { session, student_id } = row;
    if (!session.billing_type || !session.subject_id) return;

    const sessionDate = new Date(session.start_at);
    const dayStr = toDateOnlyString(sessionDate);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const targetDate = sessionDate;
    const priceResult = calculateSessionPrice(
      {
        billing_type: session.billing_type,
        subject_id: session.subject_id,
        start_at: session.start_at,
        end_at: session.end_at,
      },
      student_id,
      targetDate,
      pricingByBillingType,
      overridesBySubjectAndBilling,
      pricingOverrides,
      subsidies as unknown as StudentSubsidyRow[]
    );

    const point = predictedRevenueByDay[index];
    point.amountCents += priceResult.amount_cents;
    point.count = point.amountCents;
    const studentName = staffName(row.student_first_name, row.student_last_name, row.student_id);
    const sessionLabel = formatMetaDateTime(session.start_at);
    point.entities = [
      ...point.entities,
      {
        id: row.id,
        name: sessionLabel,
        link: {
          kind: 'session' as ReportEntityLink['kind'],
          sessionId: row.session_id,
        },
        meta: {
          session: sessionLabel,
          student: studentName,
          sessionDate: formatMetaDate(session.start_at),
          classPrice: `$${(priceResult.amount_cents / 100).toFixed(2)}`,
        },
      },
    ];
  });

  // Actual revenue + refunds + voids
  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.invoice_date);
    const invDayStr = toDateOnlyString(invoiceDate);
    const invIndex = indexByDate.get(invDayStr);

    const netAmountCents =
      invoice.amount_due_cents - (invoice.fee_cents ?? 0);

    if (invIndex !== undefined) {
      const actualPoint = actualRevenueByDay[invIndex];
      actualPoint.amountCents += netAmountCents;
      actualPoint.count = actualPoint.amountCents;

      const studentName =
        invoice.student_first_name || invoice.student_last_name
          ? `${invoice.student_first_name ?? ''} ${
              invoice.student_last_name ?? ''
            }`.trim()
          : invoice.student_id;

      const netAmount = netAmountCents / 100;
      actualPoint.entities = [
        ...actualPoint.entities,
        {
          id: invoice.id,
          name: `Invoice ${invoice.id.slice(0, 8)} · ${studentName}`,
          link: {
            kind: 'invoice' as ReportEntityLink['kind'],
            invoiceId: invoice.id,
            studentId: invoice.student_id,
          },
          meta: {
            invoice: `Invoice ${invoice.id.slice(0, 8)}`,
            student: studentName,
            invoiceDate: formatMetaDate(invoice.invoice_date),
            amount: `$${netAmount.toFixed(2)}`,
          },
        },
      ];
    }

    if (invoice.is_refunded && invoice.refunded_at) {
      const refundDate = new Date(invoice.refunded_at);
      const refundDayStr = toDateOnlyString(refundDate);
      const refundIndex = indexByDate.get(refundDayStr);
      if (refundIndex !== undefined) {
        const refundPoint = refundsByDay[refundIndex];
        refundPoint.count += 1;

        const studentName =
          invoice.student_first_name || invoice.student_last_name
            ? `${invoice.student_first_name ?? ''} ${
                invoice.student_last_name ?? ''
              }`.trim()
            : invoice.student_id;

        const refundAmount = (invoice.amount_due_cents - (invoice.fee_cents ?? 0)) / 100;
        refundPoint.entities = [
          ...refundPoint.entities,
          {
            id: invoice.id,
            name: `Refund for invoice ${invoice.id.slice(0, 8)} · ${studentName}`,
            link: {
              kind: 'refund' as ReportEntityLink['kind'],
              invoiceId: invoice.id,
              studentId: invoice.student_id,
            },
            meta: {
              type: 'refund',
              invoice: `Invoice ${invoice.id.slice(0, 8)}`,
              amount: `$${refundAmount.toFixed(2)}`,
            },
          },
        ];
      }
    }

    if (invoice.voided_at) {
      const voidDate = new Date(invoice.voided_at);
      const voidDayStr = toDateOnlyString(voidDate);
      const voidIndex = indexByDate.get(voidDayStr);
      if (voidIndex !== undefined) {
        const voidPoint = voidedInvoicesByDay[voidIndex];
        voidPoint.count += 1;

        const studentName =
          invoice.student_first_name || invoice.student_last_name
            ? `${invoice.student_first_name ?? ''} ${
                invoice.student_last_name ?? ''
              }`.trim()
            : invoice.student_id;

        const voidAmount = (invoice.amount_due_cents - (invoice.fee_cents ?? 0)) / 100;
        voidPoint.entities = [
          ...voidPoint.entities,
          {
            id: invoice.id,
            name: `Voided invoice ${invoice.id.slice(0, 8)} · ${studentName}`,
            link: {
              kind: 'invoice' as ReportEntityLink['kind'],
              invoiceId: invoice.id,
              studentId: invoice.student_id,
            },
            meta: {
              type: 'void',
              invoice: `Invoice ${invoice.id.slice(0, 8)}`,
              amount: `$${voidAmount.toFixed(2)}`,
            },
          },
        ];
      }
    }
  });

  // Credits + credit-note-based refunds/other
  creditNotes.forEach((note) => {
    const createdAt = new Date(note.created_at);
    const dayStr = toDateOnlyString(createdAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    // Settlement breakdown from DB (may not be present on older rows)
    type CreditNoteWithSettlement = typeof note & {
      refund_amount_cents?: number | null;
      credit_amount_cents?: number | null;
      out_of_band_amount_cents?: number | null;
    };

    const noteWithSettlement = note as CreditNoteWithSettlement;

    const refundAmountCents = noteWithSettlement.refund_amount_cents ?? 0;
    const creditAmountCents = noteWithSettlement.credit_amount_cents ?? 0;
    const outOfBandAmountCents = noteWithSettlement.out_of_band_amount_cents ?? 0;

    const hasRefund = refundAmountCents > 0;
    const hasCredit = creditAmountCents > 0;
    const hasOutOfBand = outOfBandAmountCents > 0;
    const invoiceShortId = note.invoice_id.slice(0, 8);
    const reason = note.reason ? ` · ${note.reason}` : '';

    // 1) Credit-note refunds: counted under refunds
    if (hasRefund) {
      const refundIndex = indexByDate.get(dayStr);
      if (refundIndex !== undefined) {
        const refundPoint = refundsByDay[refundIndex];
        refundPoint.count += 1;
        refundPoint.entities = [
          ...refundPoint.entities,
          {
            id: `credit-refund-${note.id}`,
            name: `Refund via credit note for invoice ${invoiceShortId}${reason}`,
            link: {
              kind: 'refund' as ReportEntityLink['kind'],
              invoiceId: note.invoice_id,
            },
            meta: {
              type: 'refund',
              invoice: `Invoice ${invoiceShortId}`,
              amount: `$${(refundAmountCents / 100).toFixed(2)}`,
            },
          },
        ];
      }
    }

    // 2) Credit-note credits: counted under credits
    if (hasCredit) {
      const point = creditsByDay[index];
      point.amountCents += creditAmountCents;
      point.count += 1;
      point.entities = [
        ...point.entities,
        {
          id: `credit-credit-${note.id}`,
          name: `Credit note (balance credit) for invoice ${invoiceShortId}${reason}`,
          link: {
            kind: 'credit' as ReportEntityLink['kind'],
            invoiceId: note.invoice_id,
          },
          meta: {
            type: 'credit',
            invoice: `Invoice ${invoiceShortId}`,
            amount: `$${(creditAmountCents / 100).toFixed(2)}`,
          },
        },
      ];
    }

    // 3) Out-of-band settlement: shown as "other" in billing errors table (does not affect counts)
    if (hasOutOfBand) {
      const point = creditsByDay[index];
      point.entities = [
        ...point.entities,
        {
          id: `credit-outofband-${note.id}`,
          name: `Credit note (out-of-band) for invoice ${invoiceShortId}${reason}`,
          link: {
            kind: 'credit' as ReportEntityLink['kind'],
            invoiceId: note.invoice_id,
          },
          meta: {
            type: 'other',
            invoice: `Invoice ${invoiceShortId}`,
            amount: `$${(outOfBandAmountCents / 100).toFixed(2)}`,
          },
        },
      ];
    }
  });

  // Credit balance transactions (billing.credit_balance_transaction.created)
  creditBalanceTransactions.forEach((tx) => {
    const effectiveAt = new Date(tx.effective_at);
    if (Number.isNaN(effectiveAt.getTime())) return;

    const dayStr = toDateOnlyString(effectiveAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const point = creditsByDay[index];
    point.amountCents += tx.amount_cents;
    point.count += 1;

    const invoice = tx.invoice_id
      ? invoices.find((inv) => inv.id === tx.invoice_id)
      : undefined;

    const studentName =
      invoice && (invoice.student_first_name || invoice.student_last_name)
        ? `${invoice.student_first_name ?? ''} ${
            invoice.student_last_name ?? ''
          }`.trim()
        : invoice?.student_id ?? tx.stripe_customer_id ?? 'Customer';

    const invoiceLabel = invoice
      ? `Invoice ${invoice.id.slice(0, 8)}`
      : tx.invoice_id
        ? `Invoice ${tx.invoice_id.slice(0, 8)}`
        : 'Credit balance';

    const amountLabel = `$${(tx.amount_cents / 100).toFixed(2)}`;
    const typeLabel = tx.type ?? 'unknown';

    point.entities = [
      ...point.entities,
      {
        id: `cbtxn-${tx.id}`,
        name: `${invoiceLabel} · ${studentName} · ${typeLabel}`,
        link: {
          kind: 'credit',
          invoiceId: invoice?.id ?? tx.invoice_id ?? undefined,
          studentId: invoice?.student_id,
        },
        meta: {
          // Billing errors grouping: treat all customer balance updates as "credits"
          type: 'credit',
          invoice: invoiceLabel,
          amount: amountLabel,
        },
      },
    ];
  });

  // Subsidies enrolled: count subsidies effective on each day where the student
  // is enrolled in a class for that subject on that day. Build entities for table.
  const enrollmentKey = (studentId: string, subjectId: string) =>
    `${studentId}:${subjectId}`;
  subsidiesEnrolledByDay.forEach((point, i) => {
    const day = days[i];
    if (!day) return;
    const dayStr = toDateOnlyString(day);
    const dayEnd = endOfDay(day);

    // Enrollments active on this day: (student_id, subject_id):class_id -> enrollment
    const activeEnrollmentsByKey = new Map<
      string,
      { enr: EnrollmentWithSubjectRow; key: string }
    >();
    const enrolledSet = new Set<string>();
    for (const enr of enrollmentsWithSubject) {
      const enrolledAt = new Date(enr.enrolled_at);
      if (enrolledAt > dayEnd) continue;
      if (enr.unenrolled_at != null && new Date(enr.unenrolled_at) <= dayEnd)
        continue;
      const key = enrollmentKey(enr.student_id, enr.subject_id);
      enrolledSet.add(key);
      activeEnrollmentsByKey.set(`${key}:${enr.class_id}`, { enr, key });
    }

    let count = 0;
    const countedSubsidyKeys = new Set<string>();
    for (const sub of subsidies) {
      const effectiveFrom = sub.effective_from ? new Date(sub.effective_from) : null;
      if (!effectiveFrom || effectiveFrom > dayEnd) continue;
      if (
        sub.effective_until != null &&
        new Date(sub.effective_until) <= dayEnd
      )
        continue;
      const subKey = enrollmentKey(sub.student_id, sub.subject_id);
      if (!enrolledSet.has(subKey)) continue;
      if (!countedSubsidyKeys.has(subKey)) {
        countedSubsidyKeys.add(subKey);
        count += 1;
      }

      // Add one entity per matching enrollment (student can be in multiple classes for same subject)
      for (const [mapKey, { enr }] of activeEnrollmentsByKey) {
        if (!mapKey.startsWith(`${subKey}:`)) continue;
        const studentName = staffName(
          enr.student_first_name,
          enr.student_last_name,
          enr.student_id
        );
        const entityId = `subsidy-${sub.student_id}-${sub.subject_id}-${enr.class_id}-${dayStr}`;
        point.entities = [
          ...point.entities,
          {
            id: entityId,
            name: `${studentName} · ${enr.class_short_name ?? 'Class'} · $${(sub.price_cents / 100).toFixed(2)}`,
            link: {
              kind: 'student' as ReportEntityLink['kind'],
              studentId: enr.student_id,
            },
            meta: {
              student: studentName,
              class: enr.class_short_name ?? '—',
              price: `$${(sub.price_cents / 100).toFixed(2)}`,
            },
          },
        ];
      }
    }
    point.count = count;
  });

  return {
    predictedRevenueByDay,
    actualRevenueByDay,
    refundsByDay,
    creditsByDay,
    voidedInvoicesByDay,
    subsidiesEnrolledByDay,
  };
}
