import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type {
  UninvoicedSession,
  UnloggedSession,
  UnassignedClass,
  FailedDeliveryMessage,
  UnpaidInvoice,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
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
        const { data: staffData } = await supabase
          .from('sessions_staff')
          .select(`
            staff_id,
            type,
            staff:staff(id, first_name, last_name, email)
          `)
          .eq('session_id', session.id);
        
        const assignedTutors = staffData?.map(s => ({
          id: (s.staff as any)?.id ?? s.staff_id,
          first_name: (s.staff as any)?.first_name ?? '',
          last_name: (s.staff as any)?.last_name ?? '',
          email: (s.staff as any)?.email ?? '',
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
          subject_name: (session.subject as any)?.name ?? null,
          class_id: session.class_id,
          day_of_week: (session.class as any)?.day_of_week ?? null,
          class_start_time: (session.class as any)?.start_time ?? null,
          class_end_time: (session.class as any)?.end_time ?? null,
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
            subject_name: (cls.subject as any)?.name ?? null,
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
    
    return (messages ?? []).map((msg) => {
      const conv = msg.conversation as any;
      const contact = conv?.contact as any;
      
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
    
    (studentsWithSubjects ?? []).forEach((student) => {
      const subjects = (student.students_subjects as any[]) ?? [];
      const studentActiveSubjectIds = studentSubjectClasses.get(student.id) ?? new Set();
      
      subjects.forEach((studentSubject) => {
        const subject = studentSubject.subject as any;
        if (subject && !studentActiveSubjectIds.has(subject.id)) {
          result.push({
            student_id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            subject_id: subject.id,
            subject_name: subject.name,
            subject_curriculum: subject.curriculum,
            subject_year_level: subject.year_level,
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
   */
  getStudentsWithoutPaymentMethod: async (): Promise<StudentWithoutPaymentMethod[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get all CURRENT students
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
      .eq('status', 'CURRENT')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    
    if (studentsError) throw studentsError;
    
    // Get all payment methods
    const { data: paymentMethods, error: pmError } = await supabase
      .from('student_payment_methods')
      .select('student_id');
    
    if (pmError) throw pmError;
    
    const studentsWithPaymentMethods = new Set(paymentMethods?.map(pm => pm.student_id) ?? []);
    
    // Filter to students without payment methods
    return (students ?? [])
      .filter(s => !studentsWithPaymentMethods.has(s.id))
      .map((student) => {
        const billing = (student.students_billing as any)?.[0];
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
   * Get trial students who haven't signed up
   */
  getTrialStudentsNotSignedUp: async (): Promise<TrialStudentNotSignedUp[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, phone, status, user_id, created_at, updated_at')
      .eq('status', 'TRIAL')
      .is('user_id', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    
    if (error) throw error;
    
    return (data ?? []).map((student) => ({
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      student_status: student.status,
      user_id: student.user_id,
      created_at: student.created_at ?? '',
      updated_at: student.updated_at ?? '',
    })) as TrialStudentNotSignedUp[];
  },
};
