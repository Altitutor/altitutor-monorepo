import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BillingStatsReportData,
  IssuesReportData,
  MarketingStatsReportData,
  ReportDataPoint,
  ReportEntityLink,
  RevenueReportDataPoint,
  StaffAbsencesReportData,
  StudentStatsReportData,
} from '../types';
import {
  eachDayOfInterval,
  format,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
} from 'date-fns';

type IssueRow = {
  id: string;
  name: string;
  created_at: string | null;
  resolved_at: string | null;
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
};

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  active_at: string | null;
  registered_at: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  session_start_date: string | null;
  session_end_date: string | null;
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
};

type SessionStudentRow = {
  id: string;
  session_id: string;
  session_start_at: string | null;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  planned_absence: boolean;
  planned_absence_logged_at: string | null;
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

type InvoiceItemRow = {
  id: string;
  created_at: string;
  amount_cents: number;
  is_fee: boolean;
};

type CreditNoteRow = {
  id: string;
  invoice_id: string;
  amount_cents: number;
  reason: string | null;
  created_at: string;
};

function toDateOnlyString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
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
    .select('id, name, created_at, resolved_at')
    .lte('created_at', weekEndIso);

  if (error) throw error;
  return (data ?? []) as IssueRow[];
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
      'id, staff_id, session_id, planned_absence, planned_absence_logged_at, is_swapped, swapped_sessions_staff_id'
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
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => ({
    id: row.id,
    staff_id: row.staff_id,
    staff_first_name: null,
    staff_last_name: null,
    session_id: row.session_id,
    session_start_at: null,
    planned_absence: row.planned_absence,
    planned_absence_logged_at: row.planned_absence_logged_at,
    is_swapped: row.is_swapped,
    swapped_sessions_staff_id: row.swapped_sessions_staff_id,
    swapped_staff_first_name: null,
    swapped_staff_last_name: null,
  }));
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

    const staffName =
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
      staffName,
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
    .select('id, level, session_start_date, session_end_date');

  if (error) throw error;

  const rows =
    (data as Array<{
      id: string;
      level: string | null;
      session_start_date: string | null;
      session_end_date: string | null;
    }> | null) ?? [];

  return rows.map((row) => ({
    id: row.id,
    name: row.level,
    session_start_date: row.session_start_date,
    session_end_date: row.session_end_date,
  }));
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
      class:classes(level),
      student_id,
      student:students(first_name, last_name),
      enrolled_at,
      unenrolled_at
    `
    )
    .or(`and(enrolled_at.gte.${startIso},enrolled_at.lte.${endIso}),and(unenrolled_at.gte.${startIso},unenrolled_at.lte.${endIso})`);

  if (error) throw error;

  type RawRow = {
    id: string;
    class_id: string;
    class: { level: string | null } | null;
    student_id: string;
    student: { first_name: string | null; last_name: string | null } | null;
    enrolled_at: string;
    unenrolled_at: string | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => ({
    id: row.id,
    class_id: row.class_id,
    class_name: row.class?.level ?? null,
    student_id: row.student_id,
    student_first_name: row.student?.first_name ?? null,
    student_last_name: row.student?.last_name ?? null,
    enrolled_at: row.enrolled_at,
    unenrolled_at: row.unenrolled_at,
  }));
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
      session:sessions(start_at),
      student_id,
      student:students(first_name, last_name),
      planned_absence,
      planned_absence_logged_at,
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
    session: { start_at: string | null } | null;
    student_id: string;
    student: { first_name: string | null; last_name: string | null } | null;
    planned_absence: boolean;
    planned_absence_logged_at: string | null;
    is_credited: boolean;
    credited_at: string | null;
    is_rescheduled: boolean;
    rescheduled_at: string | null;
  };

  const rows = (data ?? []) as RawRow[];

  return rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    session_start_at: row.session?.start_at ?? null,
    student_id: row.student_id,
    student_first_name: row.student?.first_name ?? null,
    student_last_name: row.student?.last_name ?? null,
    planned_absence: row.planned_absence,
    planned_absence_logged_at: row.planned_absence_logged_at,
    is_credited: row.is_credited,
    credited_at: row.credited_at,
    is_rescheduled: row.is_rescheduled,
    rescheduled_at: row.rescheduled_at,
  }));
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
        name: cls.name ? cls.name : `Class ${cls.id}`,
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
      const className =
        row.class_name ?? (row.class_id ? `Class ${row.class_id}` : 'Class');

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
        const className =
          row.class_name ?? (row.class_id ? `Class ${row.class_id}` : 'Class');

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

  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, registered_at')
    .gte('registered_at', startIso)
    .lte('registered_at', endIso);

  if (error) throw error;
  const students = (data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    registered_at: string | null;
  }>;

  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const registrationsByDay = buildEmptySeries(days);
  const indexByDate = new Map<string, number>();
  registrationsByDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  students.forEach((student) => {
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
      },
    ];
  });

  return {
    registrationsByDay,
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

async function fetchInvoiceItemsForReport(
  periodStart: Date,
  periodEnd: Date
): Promise<InvoiceItemRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data, error } = await supabase
    .from('invoice_items')
    .select('id, created_at, amount_cents, is_fee')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) throw error;
  return (data ?? []) as InvoiceItemRow[];
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
    .select('id, invoice_id, amount_cents, reason, created_at')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) throw error;
  return (data ?? []) as CreditNoteRow[];
}

export async function fetchBillingStatsReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<BillingStatsReportData> {
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const [invoices, invoiceItems, creditNotes] = await Promise.all([
    fetchInvoicesForReport(periodStart, periodEnd),
    fetchInvoiceItemsForReport(periodStart, periodEnd),
    fetchCreditNotesForReport(periodStart, periodEnd),
  ]);

  const predictedRevenueByDay = buildEmptyRevenueSeries(days);
  const actualRevenueByDay = buildEmptyRevenueSeries(days);
  const refundsByDay = buildEmptySeries(days);
  const creditsByDay = buildEmptyRevenueSeries(days);
  const voidedInvoicesByDay = buildEmptySeries(days);

  const indexByDate = new Map<string, number>();
  predictedRevenueByDay.forEach((point, index) => {
    indexByDate.set(point.date, index);
  });

  // Predicted revenue: sum of non-fee invoice items created on that day
  invoiceItems.forEach((item) => {
    const createdAt = new Date(item.created_at);
    const dayStr = toDateOnlyString(createdAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const point = predictedRevenueByDay[index];
    if (!item.is_fee) {
      point.amountCents += item.amount_cents;
      point.count = point.amountCents;
    }
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

      actualPoint.entities = [
        ...actualPoint.entities,
        {
          id: invoice.id,
          name: `Invoice ${invoice.id.slice(0, 8)} · ${studentName}`,
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

        refundPoint.entities = [
          ...refundPoint.entities,
          {
            id: invoice.id,
            name: `Refund for invoice ${invoice.id.slice(
              0,
              8
            )} · ${studentName}`,
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

        voidPoint.entities = [
          ...voidPoint.entities,
          {
            id: invoice.id,
            name: `Voided invoice ${invoice.id.slice(0, 8)} · ${studentName}`,
          },
        ];
      }
    }
  });

  // Credits
  creditNotes.forEach((note) => {
    const createdAt = new Date(note.created_at);
    const dayStr = toDateOnlyString(createdAt);
    const index = indexByDate.get(dayStr);
    if (index === undefined) return;

    const point = creditsByDay[index];
    point.amountCents += note.amount_cents;
    point.count = point.amountCents;
    const reason = note.reason ? ` · ${note.reason}` : '';
    point.entities = [
      ...point.entities,
      {
        id: note.id,
        name: `Credit note for invoice ${note.invoice_id}${reason}`,
        link: {
          kind: 'credit',
          invoiceId: note.invoice_id,
        },
      },
    ];
  });

  return {
    predictedRevenueByDay,
    actualRevenueByDay,
    refundsByDay,
    creditsByDay,
    voidedInvoicesByDay,
  };
}
