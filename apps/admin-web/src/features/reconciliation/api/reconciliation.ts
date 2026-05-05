import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import { tasksApi } from '@/features/tasks/api/tasks';
import { fetchConversationsByContact } from '@/features/messages/api/queries';
import type {
  UninvoicedSession,
  UnloggedSession,
  UnassignedClass,
  FailedDeliveryMessage,
  UnpaidInvoice,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
  UnassignedTask,
  VoidInvoiceSession,
  ProjectWithoutLead,
  ReconciliationTabCounts,
} from '../types';

// Helper type for querying views
type ViewQueryResult<T> = {
  data: T[] | null;
  error: Error | null;
};

type ViewSelectChain = {
  order: (column: string, options: { ascending: boolean }) => ViewSelectChain;
} & Promise<ViewQueryResult<unknown>>;

type ViewQueryBuilder = {
  select: (columns: string) => ViewSelectChain;
};

type SupabaseWithViews = SupabaseClient<Database> & {
  from: (table: string) => ViewQueryBuilder;
};

type ViewCountBuilder = {
  select: (
    columns: string,
    options: { count: 'exact'; head: true }
  ) => Promise<{ count: number | null; error: Error | null }>;
};

type SupabaseWithViewCounts = SupabaseClient<Database> & {
  from: (table: string) => ViewCountBuilder;
};

/** Rows from reconciliation views that carry session_id + optional view/session labels. */
type ReconciliationSessionRow = {
  session_id: string;
  session_name?: string | null;
  session_short_name?: string | null;
};

/**
 * Prefer `sessions.short_name`, then `sessions.long_name`, then any view `session_short_name`,
 * then composite `session_name` — live session row wins over view denormalization.
 */
async function enrichReconciliationSessionRows<T extends ReconciliationSessionRow>(
  supabase: SupabaseClient<Database>,
  rows: T[]
): Promise<T[]> {
  const sessionIds = [
    ...new Set(rows.map((r) => r.session_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
  if (sessionIds.length === 0) return rows;

  const { data: sessionRows, error } = await supabase
    .from('sessions')
    .select('id, short_name, long_name')
    .in('id', sessionIds);
  if (error) throw error;

  const byId = new Map((sessionRows ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const s = byId.get(row.session_id);
    const fromView = row.session_short_name?.trim();
    const fromSessionShort = s?.short_name?.trim();
    const fromSessionLong = s?.long_name?.trim();
    const merged =
      fromSessionShort ||
      fromSessionLong ||
      fromView ||
      row.session_name?.trim() ||
      null;
    return { ...row, session_short_name: merged || null } as T;
  });
}

function parseAssignedTutorsFromView(raw: unknown): UnloggedSession['assigned_tutors'] {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length === 0) return [];
  return parsed as NonNullable<UnloggedSession['assigned_tutors']>;
}

/**
 * Reconciliation API client for querying reconciliation views
 */
export const reconciliationApi = {
  /**
   * Get uninvoiced sessions
   */
  getUninvoicedSessions: async (): Promise<UninvoicedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as UninvoicedSession[];
    return enrichReconciliationSessionRows(supabase, rows);
  },

  /**
   * Get unpaid invoices
   */
  getUnpaidInvoices: async (): Promise<UnpaidInvoice[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        student_id,
        invoice_date,
        status,
        amount_due_cents,
        currency,
        stripe_invoice_id,
        stripe_invoice_number,
        collection_method,
        metadata,
        student:students!invoices_student_id_fkey (
          first_name,
          last_name,
          email
        ),
        invoice_items (
          session_id,
          deleted_at,
          sessions (
            start_at,
            short_name,
            long_name
          )
        )
      `)
      .neq('status', 'paid')
      .neq('status', 'void')
      .gt('amount_due_cents', 0)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: true });
    
    if (error) throw error;
    
    // Transform the data to match UnpaidInvoice type
    type InvoiceQueryResult = {
      id: string;
      student_id: string;
      invoice_date: string;
      status: string;
      amount_due_cents: number;
      currency: string;
      stripe_invoice_id: string | null;
      stripe_invoice_number: string | null;
      collection_method: string | null;
      metadata: unknown;
      student: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      invoice_items?:
        | {
            session_id: string | null;
            deleted_at: string | null;
            sessions: { start_at: string | null; short_name: string | null; long_name: string | null } | null;
          }[]
        | null;
    };
    
    return (data ?? []).map((invoice: InvoiceQueryResult) => {
      const student = invoice.student;
      const firstLine = (invoice.invoice_items ?? []).find(
        (row) => row.session_id && row.deleted_at == null
      );
      const lineSessionId = firstLine?.session_id ?? null;
      const sessionStartAt = firstLine?.sessions?.start_at ?? null;
      const sessionShortName =
        firstLine?.sessions?.short_name?.trim() ||
        firstLine?.sessions?.long_name?.trim() ||
        null;
      type InvoiceMetadata = {
        last_payment_error?: {
          code: string;
          message: string;
          type: string;
        } | null;
      };
      const metadata = (invoice.metadata as InvoiceMetadata | null) ?? null;
      const lastPaymentError = metadata?.last_payment_error || null;
      
      return {
        id: invoice.id,
        student_id: invoice.student_id,
        invoice_date: invoice.invoice_date,
        due_date: null, // invoices table doesn't have due_date column
        status: invoice.status,
        amount_due_cents: invoice.amount_due_cents,
        currency: invoice.currency,
        stripe_invoice_id: invoice.stripe_invoice_id,
        stripe_invoice_number: invoice.stripe_invoice_number,
        collection_method: invoice.collection_method,
        last_payment_error: lastPaymentError,
        student_first_name: student?.first_name || null,
        student_last_name: student?.last_name || null,
        student_email: student?.email || null,
        days_overdue: null, // Cannot calculate without due_date
        session_id: lineSessionId,
        session_start_at: sessionStartAt,
        session_short_name: sessionShortName,
      } as UnpaidInvoice;
    });
  },

  /**
   * Get unlogged sessions (single query via vadmin_reconciliation_unlogged_sessions).
   */
  getUnloggedSessions: async (): Promise<UnloggedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unlogged_sessions')
      .select('*')
      .order('start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const dow = r.day_of_week;
      return {
        session_id: String(r.session_id),
        start_at: String(r.start_at ?? ''),
        end_at: (r.end_at as string | null) ?? null,
        session_type: String(r.session_type ?? ''),
        session_name: String(r.session_name ?? 'Session'),
        subject_id: (r.subject_id as string | null) ?? null,
        subject_name: (r.subject_name as string | null) ?? null,
        class_id: (r.class_id as string | null) ?? null,
        day_of_week: typeof dow === 'number' ? dow : dow != null ? Number(dow) : null,
        class_start_time: (r.class_start_time as string | null) ?? null,
        class_end_time: (r.class_end_time as string | null) ?? null,
        assigned_tutors: parseAssignedTutorsFromView(r.assigned_tutors),
        student_count: Number(r.student_count ?? 0),
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
      } as UnloggedSession;
    });
  },

  /**
   * Get unassigned classes (single query via vadmin_reconciliation_unassigned_classes).
   */
  getUnassignedClasses: async (): Promise<UnassignedClass[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unassigned_classes')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        class_id: String(r.class_id),
        class_display_name: String(r.class_display_name ?? 'Class'),
        subject_id: (r.subject_id as string | null) ?? null,
        subject_name: (r.subject_name as string | null) ?? null,
        day_of_week: Number(r.day_of_week),
        start_time: String(r.start_time ?? ''),
        end_time: String(r.end_time ?? ''),
        class_status: String(r.class_status ?? ''),
        room: (r.room as string | null) ?? null,
        level: (r.level as string | null) ?? null,
        student_count: Number(r.student_count ?? 0),
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
      } as UnassignedClass;
    });
  },


  /**
   * Get unassigned tasks (tasks with no assignee)
   */
  getUnassignedTasks: async (): Promise<UnassignedTask[]> => {
    const tasks = await tasksApi.list({
      unassignedOnly: true,
      status: ['backlog', 'todo', 'in_progress', 'in_review'],
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      created_at: t.created_at ?? '',
      updated_at: t.updated_at ?? '',
      issue: t.issue ?? null,
      project: t.project ?? null,
    }));
  },

  /**
   * Active projects with no project lead (excludes completed).
   */
  getProjectsWithNoLead: async (): Promise<ProjectWithoutLead[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        status,
        priority,
        target_date,
        created_at,
        updated_at,
        creator:staff!projects_created_by_fkey(id, first_name, last_name)
      `)
      .is('project_lead_id', null)
      .neq('status', 'completed')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as ProjectWithoutLead[];
  },

  /**
   * Get failed delivery messages
   */
  getFailedDeliveryMessages: async (): Promise<FailedDeliveryMessage[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        direction,
        body,
        status,
        status_updated_at,
        error_code,
        error_message,
        message_sid,
        from_number_e164,
        to_number_e164,
        created_at,
        updated_at,
        conversation:conversations(
          status,
          assigned_staff_id,
          last_message_at,
          contact:contacts(
            contact_type,
            student_id,
            parent_id,
            staff_id,
            phone_e164,
            student:students(first_name, last_name),
            parent:parents(first_name, last_name),
            staff:staff(first_name, last_name)
          )
        )
      `)
      .eq('direction', 'OUTBOUND')
      .in('status', ['FAILED', 'UNDELIVERED'])
      .not('status_updated_at', 'is', null)
      .order('status_updated_at', { ascending: false });
    
    if (messagesError) throw messagesError;
    
    type ConversationWithContact = { status?: string; assigned_staff_id?: string; last_message_at?: string; contact?: { contact_type?: string; student?: { first_name: string; last_name: string }; parent?: { first_name: string; last_name: string }; staff?: { first_name: string; last_name: string }; phone_e164?: string; student_id?: string; parent_id?: string; staff_id?: string } };
    return (messages ?? []).map((msg) => {
      const conv = msg.conversation as ConversationWithContact | null;
      const contact = conv?.contact;
      
      // Build contact name
      let contactName: string | null = null;
      if (contact?.contact_type === 'STUDENT' && contact?.student) {
        contactName = `${contact.student.first_name} ${contact.student.last_name}`;
      } else if (contact?.contact_type === 'PARENT' && contact?.parent) {
        contactName = `${contact.parent.first_name} ${contact.parent.last_name}`;
      } else if (contact?.contact_type === 'STAFF' && contact?.staff) {
        contactName = `${contact.staff.first_name} ${contact.staff.last_name}`;
      }
      
      // Calculate hours since failure
      const hoursSinceFailure = msg.status_updated_at
        ? (Date.now() - new Date(msg.status_updated_at).getTime()) / (1000 * 60 * 60)
        : null;
      
      return {
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        direction: msg.direction,
        body: msg.body,
        status: msg.status,
        status_updated_at: msg.status_updated_at,
        error_code: msg.error_code,
        error_message: msg.error_message,
        message_sid: msg.message_sid,
        from_number_e164: msg.from_number_e164,
        to_number_e164: msg.to_number_e164 ?? '',
        created_at: msg.created_at ?? '',
        updated_at: msg.updated_at,
        conversation_status: conv?.status ?? '',
        assigned_staff_id: conv?.assigned_staff_id,
        conversation_last_message_at: conv?.last_message_at,
        contact_name: contactName,
        contact_phone: contact?.phone_e164 ?? '',
        contact_type: contact?.contact_type ?? '',
        student_id: contact?.student_id,
        parent_id: contact?.parent_id,
        staff_id: contact?.staff_id,
        hours_since_failure: hoursSinceFailure,
      } as FailedDeliveryMessage;
    });
  },

  /**
   * Students who should have a class per subject but do not.
   *
   * Subject scope matches the student profile subject list (direct `students_subjects` rows plus
   * `students_online_access_manual` grants).
   */
  getStudentsWithoutClasses: async (): Promise<StudentWithoutClasses[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    type StudentSubjectRow = {
      created_at?: string;
      subject?: {
        id: string;
        name?: string;
        short_name?: string | null;
        long_name?: string | null;
        curriculum?: string;
        year_level?: string | number | null;
      } | null;
    };

    // Get ACTIVE students with their subjects
    const { data: studentsWithSubjects, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        status,
        created_at,
        updated_at,
        students_subjects(
          created_at,
          subject:subjects(
            id,
            name,
            short_name,
            long_name,
            curriculum,
            year_level
          )
        )
      `)
      .eq('status', 'ACTIVE')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) throw studentsError;

    const studentIds = (studentsWithSubjects ?? []).map((s) => s.id);

    let manualSubjectRows: Array<{
      student_id: string;
      created_at: string | null;
      subject: StudentSubjectRow['subject'];
    }> = [];

    if (studentIds.length > 0) {
      const { data: manualData, error: manualError } = await supabase
        .from('students_online_access_manual')
        .select(`
          student_id,
          created_at,
          subject:subjects(
            id,
            name,
            short_name,
            long_name,
            curriculum,
            year_level
          )
        `)
        .in('student_id', studentIds);

      if (manualError) throw manualError;
      manualSubjectRows = (manualData ?? []) as typeof manualSubjectRows;
    }

    const manualByStudentId = new Map<string, StudentSubjectRow[]>();
    for (const row of manualSubjectRows) {
      if (!row.subject?.id) continue;
      const list = manualByStudentId.get(row.student_id) ?? [];
      list.push({ created_at: row.created_at ?? undefined, subject: row.subject });
      manualByStudentId.set(row.student_id, list);
    }
    
    // Get all active class enrollments
    const { data: classEnrollments, error: enrollmentsError } = await supabase
      .from('classes_students')
      .select('student_id, class_id')
      .is('unenrolled_at', null);
    
    if (enrollmentsError) throw enrollmentsError;
    
    // Get class details for enrolled classes
    const classIds = [...new Set((classEnrollments ?? []).map(e => e.class_id))];
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, subject_id, status')
      .in('id', classIds)
      .eq('status', 'ACTIVE');
    
    if (classesError) throw classesError;
    
    // Build a map of class_id -> subject_id for active classes
    const classSubjectMap = new Map<string, string>();
    (classes ?? []).forEach((cls) => {
      if (cls.subject_id) {
        classSubjectMap.set(cls.id, cls.subject_id);
      }
    });
    
    // Build a map of student_id -> Set of subject_ids they have active classes for
    const studentSubjectClasses = new Map<string, Set<string>>();
    (classEnrollments ?? []).forEach((enrollment) => {
      const subjectId = classSubjectMap.get(enrollment.class_id);
      if (subjectId) {
        const studentId = enrollment.student_id;
        if (!studentSubjectClasses.has(studentId)) {
          studentSubjectClasses.set(studentId, new Set());
        }
        studentSubjectClasses.get(studentId)!.add(subjectId);
      }
    });
    
    // Build result: one row per student-subject combination where student has no active class for that subject
    const result: StudentWithoutClasses[] = [];

    (studentsWithSubjects ?? []).forEach((student) => {
      const ssRows = (student.students_subjects as StudentSubjectRow[] | null) ?? [];
      const manualRowsForStudent = manualByStudentId.get(student.id) ?? [];

      const mergedBySubjectId = new Map<string, StudentSubjectRow>();
      for (const r of ssRows) {
        const sid = r.subject?.id;
        if (sid) mergedBySubjectId.set(sid, r);
      }
      for (const r of manualRowsForStudent) {
        const sid = r.subject?.id;
        if (sid && !mergedBySubjectId.has(sid)) mergedBySubjectId.set(sid, r);
      }

      const studentActiveSubjectIds = studentSubjectClasses.get(student.id) ?? new Set();

      for (const studentSubject of mergedBySubjectId.values()) {
        const subject = studentSubject.subject;
        if (subject && !studentActiveSubjectIds.has(subject.id)) {
          result.push({
            student_id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            subject_id: subject.id,
            subject_name: subject.name ?? '',
            subject_short_name: subject.short_name ?? null,
            subject_long_name: subject.long_name ?? null,
            subject_curriculum: subject.curriculum ?? null,
            subject_year_level: typeof subject.year_level === 'number' ? subject.year_level : null,
            subject_added_at: studentSubject.created_at ?? null,
            created_at: student.created_at ?? '',
            updated_at: student.updated_at ?? '',
          });
        }
      }
    });
    
    // Sort by last_name, then first_name
    result.sort((a, b) => {
      const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.first_name || '').localeCompare(b.first_name || '');
    });
    
    return result;
  },

  /**
   * ACTIVE students with no `student_payment_methods` rows (via reconciliation view).
   * RLS on underlying tables still applies; ADMINSTAFF is required for payment-method data.
   */
  getStudentsWithoutPaymentMethod: async (): Promise<StudentWithoutPaymentMethod[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_students_without_payment_method')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as StudentWithoutPaymentMethod[];
  },

  /**
   * Get trial students who have at least one trial session in the past
   */
  getTrialStudentsNotSignedUp: async (): Promise<TrialStudentNotSignedUp[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // First, find all TRIAL_SESSION sessions that are in the past
    const now = new Date().toISOString();
    const { data: pastTrialSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, start_at')
      .eq('type', 'TRIAL_SESSION')
      .lt('start_at', now)
      .order('start_at', { ascending: true });
    
    if (sessionsError) throw sessionsError;
    
    // If no past trial sessions found, return empty array
    if (!pastTrialSessions || pastTrialSessions.length === 0) {
      return [];
    }
    
    // Get student IDs who attended these past trial sessions, with session dates
    const sessionIds = pastTrialSessions.map((s) => s.id);
    const { data: sessionsStudentsData, error: sessionsStudentsError } = await supabase
      .from('sessions_students')
      .select('student_id, session_id, sessions!inner(start_at)')
      .in('session_id', sessionIds);
    
    if (sessionsStudentsError) throw sessionsStudentsError;
    
    // Build a map of student_id -> first trial session date + session id
    const studentFirstTrialSessionMap = new Map<string, { date: string; sessionId: string }>();
    if (sessionsStudentsData) {
      sessionsStudentsData.forEach((item) => {
        const session = item.sessions as { start_at: string } | null;
        if (session?.start_at) {
          const studentId = item.student_id;
          const existing = studentFirstTrialSessionMap.get(studentId);
          if (!existing || new Date(session.start_at) < new Date(existing.date)) {
            studentFirstTrialSessionMap.set(studentId, {
              date: session.start_at,
              sessionId: item.session_id,
            });
          }
        }
      });
    }
    
    // Get unique student IDs
    const studentIdsWithPastTrialSessions = Array.from(studentFirstTrialSessionMap.keys());
    
    // If no students found, return empty array
    if (studentIdsWithPastTrialSessions.length === 0) {
      return [];
    }
    
    // Now query trial students who have past trial sessions
    // Note: Removed user_id IS NULL filter per user request - now includes all trial students with past sessions
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, phone, status, user_id, created_at, updated_at')
      .eq('status', 'TRIAL')
      .in('id', studentIdsWithPastTrialSessions);
    
    if (error) throw error;
    
    // Map students with their first trial session date and sort by date ascending
    const result = (data ?? []).map((student) => ({
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      student_status: student.status,
      user_id: student.user_id,
      first_trial_session_date: studentFirstTrialSessionMap.get(student.id)?.date ?? null,
      first_trial_session_id: studentFirstTrialSessionMap.get(student.id)?.sessionId ?? null,
      created_at: student.created_at ?? '',
      updated_at: student.updated_at ?? '',
    })) as TrialStudentNotSignedUp[];
    
    // Sort by first trial session date ascending
    result.sort((a, b) => {
      const dateA = a.first_trial_session_date ? new Date(a.first_trial_session_date).getTime() : 0;
      const dateB = b.first_trial_session_date ? new Date(b.first_trial_session_date).getTime() : 0;
      return dateA - dateB;
    });
    
    return result;
  },

  getVoidInvoiceSessions: async (): Promise<VoidInvoiceSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_void_invoice_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as VoidInvoiceSession[];
    return enrichReconciliationSessionRows(supabase, rows);
  },
};

async function countReconciliationViewRows(viewName: string): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await (supabase as unknown as SupabaseWithViewCounts)
    .from(viewName)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countUnpaidInvoicesExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'paid')
    .neq('status', 'void')
    .gt('amount_due_cents', 0)
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

async function countFailedDeliveryMessagesExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'OUTBOUND')
    .in('status', ['FAILED', 'UNDELIVERED'])
    .not('status_updated_at', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

async function countUnassignedTasksExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .is('assigned_to', null)
    .in('status', ['backlog', 'todo', 'in_progress', 'in_review']);
  if (error) throw error;
  return count ?? 0;
}

async function countProjectsWithoutLeadExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .is('project_lead_id', null)
    .neq('status', 'completed');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Parallel counts for reconciliation tab badges. Uses exact `COUNT` / head requests where possible
 * so badges do not re-fetch full reconciliation lists (scheduling counts use restored DB views).
 */
export async function getReconciliationTabCounts(): Promise<ReconciliationTabCounts> {
  const [
    uninvoicedCount,
    voidCount,
    unpaidCount,
    noPaymentCount,
    unloggedCount,
    unassignedClassesCount,
    studentsWithoutClassesCount,
    trialCount,
    failedCount,
    conversationsByContact,
    unassignedTasksCount,
    projectsNoLeadCount,
  ] = await Promise.all([
    countReconciliationViewRows('vadmin_reconciliation_uninvoiced_sessions'),
    countReconciliationViewRows('vadmin_reconciliation_void_invoice_sessions'),
    countUnpaidInvoicesExact(),
    countReconciliationViewRows('vadmin_reconciliation_students_without_payment_method'),
    countReconciliationViewRows('vadmin_reconciliation_unlogged_sessions'),
    countReconciliationViewRows('vadmin_reconciliation_unassigned_classes'),
    reconciliationApi.getStudentsWithoutClasses().then((r) => r.length),
    reconciliationApi.getTrialStudentsNotSignedUp().then((r) => r.length),
    countFailedDeliveryMessagesExact(),
    fetchConversationsByContact(),
    countUnassignedTasksExact(),
    countProjectsWithoutLeadExact(),
  ]);

  const unreadContacts = conversationsByContact.filter((c) => c.unreadCount > 0).length;
  const followUpContacts = conversationsByContact.filter((c) =>
    c.conversations.some((conv) => conv.needs_follow_up)
  ).length;

  return {
    financial: uninvoicedCount + voidCount + unpaidCount + noPaymentCount,
    scheduling: unloggedCount + unassignedClassesCount + studentsWithoutClassesCount + trialCount,
    communication: failedCount + unreadContacts + followUpContacts,
    operations: unassignedTasksCount + projectsNoLeadCount,
  };
}
