import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import { tasksApi } from '@/features/tasks/api/tasks';
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
} from '../types';

// Helper type for querying views
type ViewQueryResult<T> = {
  data: T[] | null;
  error: Error | null;
};

type ViewQueryBuilder = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<ViewQueryResult<unknown>>;
  };
};

type SupabaseWithViews = SupabaseClient<Database> & {
  from: (table: string) => ViewQueryBuilder;
};

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
    return (data ?? []) as UninvoicedSession[];
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
        collection_method,
        metadata,
        student:students!invoices_student_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .neq('status', 'paid')
      .neq('status', 'void')
      .gt('amount_due_cents', 0)
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
      collection_method: string | null;
      metadata: unknown;
      student: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
    };
    
    return (data ?? []).map((invoice: InvoiceQueryResult) => {
      const student = invoice.student;
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
        collection_method: invoice.collection_method,
        last_payment_error: lastPaymentError,
        student_first_name: student?.first_name || null,
        student_last_name: student?.last_name || null,
        student_email: student?.email || null,
        days_overdue: null, // Cannot calculate without due_date
      } as UnpaidInvoice;
    });
  },

  /**
   * Get unlogged sessions
   */
  getUnloggedSessions: async (): Promise<UnloggedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Query sessions without tutor_logs
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        start_at,
        end_at,
        type,
        subject_id,
        class_id,
        created_at,
        updated_at,
        subject:subjects(name),
        class:classes(day_of_week, start_time, end_time)
      `)
      .lt('start_at', new Date().toISOString())
      .order('start_at', { ascending: false });
    
    if (sessionsError) throw sessionsError;
    
    // Get tutor_logs to filter out sessions that have logs
    const { data: tutorLogs, error: logsError } = await supabase
      .from('tutor_logs')
      .select('session_id');
    
    if (logsError) throw logsError;
    
    const loggedSessionIds = new Set(tutorLogs?.map(log => log.session_id) ?? []);
    
    // Filter out sessions with tutor logs and fetch additional data
    const unloggedSessions = (sessions ?? []).filter(s => !loggedSessionIds.has(s.id));
    
    // Fetch assigned tutors and student counts for each session
    const sessionsWithDetails = await Promise.all(
      unloggedSessions.map(async (session) => {
        // Get assigned tutors
        const { data: staffData, error: staffError } = await supabase
          .from('sessions_staff')
          .select(`
            staff_id,
            type,
            staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name, email)
          `)
          .eq('session_id', session.id);
        
        if (staffError) throw staffError;
        
        type StaffRow = { staff_id: string; type: string; staff: { id: string; first_name: string; last_name: string; email: string | null } | null };
        const assignedTutors = staffData?.map((s: StaffRow) => ({
          id: s.staff?.id ?? s.staff_id,
          first_name: s.staff?.first_name ?? '',
          last_name: s.staff?.last_name ?? '',
          email: s.staff?.email ?? '',
          type: s.type,
        })) ?? null;
        
        // Get student count
        const { count } = await supabase
          .from('sessions_students')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('planned_absence', false);
        
        return {
          session_id: session.id,
          start_at: session.start_at ?? '',
          end_at: session.end_at,
          session_type: session.type,
          subject_id: session.subject_id,
          subject_name: (session.subject as { name?: string } | null)?.name ?? null,
          class_id: session.class_id,
          day_of_week: (session.class as { day_of_week?: number } | null)?.day_of_week ?? null,
          class_start_time: (session.class as { start_time?: string } | null)?.start_time ?? null,
          class_end_time: (session.class as { end_time?: string } | null)?.end_time ?? null,
          assigned_tutors: assignedTutors,
          student_count: count ?? 0,
          created_at: session.created_at ?? '',
          updated_at: session.updated_at ?? '',
        } as UnloggedSession;
      })
    );
    
    return sessionsWithDetails;
  },

  /**
   * Get unassigned classes
   */
  getUnassignedClasses: async (): Promise<UnassignedClass[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get all active classes
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select(`
        id,
        subject_id,
        day_of_week,
        start_time,
        end_time,
        status,
        room,
        level,
        created_at,
        updated_at,
        subject:subjects(name)
      `)
      .eq('status', 'ACTIVE')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (classesError) throw classesError;
    
    // Get all active class-staff assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('classes_staff')
      .select('class_id')
      .is('unassigned_at', null);
    
    if (assignmentsError) throw assignmentsError;
    
    const assignedClassIds = new Set(assignments?.map(a => a.class_id) ?? []);
    
    // Filter to only unassigned classes and fetch student counts
    const unassignedClasses = await Promise.all(
      (classes ?? [])
        .filter(c => !assignedClassIds.has(c.id))
        .map(async (cls) => {
          // Get student count
          const { count } = await supabase
            .from('classes_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .is('unenrolled_at', null);
          
          return {
            class_id: cls.id,
            subject_id: cls.subject_id,
            subject_name: (cls.subject as { name?: string } | null)?.name ?? null,
            day_of_week: cls.day_of_week,
            start_time: cls.start_time,
            end_time: cls.end_time,
            class_status: cls.status,
            room: cls.room,
            level: cls.level,
            student_count: count ?? 0,
            created_at: cls.created_at ?? '',
            updated_at: cls.updated_at ?? '',
          } as UnassignedClass;
        })
    );
    
    return unassignedClasses;
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
   * Get students without classes
   */
  getStudentsWithoutClasses: async (): Promise<StudentWithoutClasses[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
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
            curriculum,
            year_level
          )
        )
      `)
      .eq('status', 'ACTIVE')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    
    if (studentsError) throw studentsError;
    
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
    
    type StudentSubjectRow = { created_at?: string; subject?: { id: string; name?: string; curriculum?: string; year_level?: string | number | null } | null };
    (studentsWithSubjects ?? []).forEach((student) => {
      const subjects = (student.students_subjects as StudentSubjectRow[] | null) ?? [];
      const studentActiveSubjectIds = studentSubjectClasses.get(student.id) ?? new Set();
      
      subjects.forEach((studentSubject: StudentSubjectRow) => {
        const subject = studentSubject.subject;
        if (subject && !studentActiveSubjectIds.has(subject.id)) {
          result.push({
            student_id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            subject_id: subject.id,
            subject_name: subject.name ?? '',
            subject_curriculum: subject.curriculum ?? null,
            subject_year_level: typeof subject.year_level === 'number' ? subject.year_level : null,
            subject_added_at: studentSubject.created_at ?? null,
            created_at: student.created_at ?? '',
            updated_at: student.updated_at ?? '',
          });
        }
      });
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
   * Get students without payment method
   * 
   * Query Logic:
   * 1. Fetches all students with status = 'ACTIVE'
   * 2. Fetches all payment methods from student_payment_methods table
   *    - Note: RLS policy requires ADMINSTAFF role to access this table
   *    - If query runs without ADMINSTAFF permissions, no payment methods will be returned,
   *      causing ALL students to appear as having no payment method
   * 3. Filters students to only those NOT in the set of students with payment methods
   * 
   * Potential Issues:
   * - Only includes students with status = 'ACTIVE' (excludes TRIAL, INACTIVE, etc.)
   * - RLS on student_payment_methods may filter results if not running as ADMINSTAFF
   * - Payment methods are hard-deleted (no soft delete), so deleted methods won't appear
   */
  getStudentsWithoutPaymentMethod: async (): Promise<StudentWithoutPaymentMethod[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get all ACTIVE students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        created_at,
        updated_at,
        students_billing(stripe_customer_id, created_at)
      `)
      .eq('status', 'ACTIVE')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    
    if (studentsError) throw studentsError;
    
    // Get all payment methods
    // IMPORTANT: This query requires ADMINSTAFF role due to RLS policies
    // If this query returns empty/null, check that the user has ADMINSTAFF role
    const { data: paymentMethods, error: pmError } = await supabase
      .from('student_payment_methods')
      .select('student_id');
    
    if (pmError) {
      console.error('[getStudentsWithoutPaymentMethod] Error fetching payment methods:', pmError);
      throw pmError;
    }
    
    // Build set of student IDs who have payment methods
    const studentsWithPaymentMethods = new Set(paymentMethods?.map(pm => pm.student_id) ?? []);
    
    // Filter to students without payment methods
    return (students ?? [])
      .filter(s => !studentsWithPaymentMethods.has(s.id))
      .map((student) => {
        type StudentsBillingRow = { stripe_customer_id?: string; created_at?: string }[];
        const billing = (student.students_billing as StudentsBillingRow | null)?.[0];
        return {
          student_id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          phone: student.phone,
          student_status: student.status,
          stripe_customer_id: billing?.stripe_customer_id ?? null,
          billing_created_at: billing?.created_at ?? null,
          created_at: student.created_at ?? '',
          updated_at: student.updated_at ?? '',
        } as StudentWithoutPaymentMethod;
      });
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
};
