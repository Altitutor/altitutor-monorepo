import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';

// Type definitions for RPC responses and joined queries
type SessionStudentRow = {
  planned_absence: boolean;
  student: Tables<'students'> | null;
};

type SessionStaffRow = {
  planned_absence: boolean;
  staff: Tables<'staff'> | null;
};

type SessionWithRelationsRow = {
  student: Tables<'students'> | null;
};

type SessionStaffWithRelationsRow = {
  staff: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone_number' | 'status' | 'role'> | null;
};

type SearchSessionsRpcResponse = {
  sessions: Tables<'sessions'>[];
  sessionStudents: Record<string, Array<Tables<'students'> & {
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    actual_was_trial?: boolean | null;
    invoice_status_payload?: import('@/features/billing/utils/invoiceFormatters').InvoiceStatusPayload | null;
    sessions_students_id?: string | null;
    is_extra?: boolean;
    was_trial?: boolean;
    is_rescheduled?: boolean;
    is_credited?: boolean;
    rescheduled_session?: {
      session?: {
        id: string;
        start_at?: string;
        class?: {
          start_time?: string | null;
        } | null;
      } | null;
    } | null;
  }>>;
  sessionStaff: Record<string, Array<Tables<'staff'> & {
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
    is_swapped_in?: boolean;
    is_swapped?: boolean;
    swapped_staff?: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
  }>>;
  tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  total: number;
};

type SessionStudentWithDetails = Tables<'sessions_students'> & {
  student: Tables<'students'> | null;
  rescheduled_sessions_students_id?: string | null;
};

type RescheduledSessionRow = {
  id: string;
  session: (Tables<'sessions'> & {
    class: Tables<'classes'> | null;
  }) | null;
};

type EnrollmentRow = {
  student_id: string;
  unenrolled_at: string | null;
};

type SessionStaffWithDetails = Tables<'sessions_staff'> & {
  swapped_sessions_staff_id?: string | null;
};

type TutorLogTopicRow = Tables<'tutor_logs_topics'> & {
  topic: Tables<'topics'> | null;
};

type TutorLogTopicStudentRow = Tables<'tutor_logs_topics_students'> & {
  student: Tables<'students'> | null;
};

type TutorLogTopicFileRow = Tables<'tutor_logs_topics_files'> & {
  topics_file: (Tables<'topics_files'> & {
    file: Tables<'files'> | null;
  }) | null;
};

type TutorLogTopicFileStudentRow = Tables<'tutor_logs_topics_files_students'> & {
  student: Tables<'students'> | null;
};

type TutorLogStudentAttendanceRow = Tables<'tutor_logs_student_attendance'> & {
  student: Tables<'students'> | null;
};

type TutorLogStaffAttendanceRow = Tables<'tutor_logs_staff_attendance'> & {
  staff: Tables<'staff'> | null;
};

type TutorLogParentAttendanceRow = Tables<'tutor_logs_parent_attendance'> & {
  parent: Tables<'parents'> | null;
};

type NoteWithStaff = Omit<Tables<'notes'>, 'created_by'> & {
  created_by: string;
  staff: Tables<'staff'> | null;
};

/**
 * Sessions API client for working with session data
 */
export const sessionsApi = {
  /**
   * Get all sessions
   */
  getAllSessions: async (includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Use server-side search function to avoid pagination limits
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
        p_search: undefined, // No search term - get all
        p_range_start: undefined,
        p_range_end: undefined,
        p_staff_id: undefined,
        p_class_id: undefined,
        p_student_id: undefined,
        p_statuses: includeInactive ? undefined : ['ACTIVE'], // Filter by status if needed
        p_types: undefined,
        p_include_relationships: false, // We don't need relationships for basic list
        p_limit: 10000, // High limit to get all sessions
        p_offset: 0,
        p_order_by: 'start_at',
        p_ascending: false, // Most recent first
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { sessions: Tables<'sessions'>[]; total: number };
      // Transform RPC response to match Tables<'sessions'> format
      return (rpcData.sessions || []).map((s) => ({
        id: s.id,
        class_id: s.class_id,
        start_at: s.start_at,
        end_at: s.end_at,
        status: s.status,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'sessions'>[];
    } catch (error) {
      console.error('Error getting all sessions:', error);
      throw error;
    }
  },

  /**
   * Get all sessions with their attendees and staff using optimized RPC function
   * This replaces the previous multi-query approach with a single RPC call
   */
  getAllSessionsWithDetails: async (args?: { rangeStart?: string; rangeEnd?: string; includeInactive?: boolean; search?: string; studentId?: string; staffId?: string; classId?: string; adminShiftId?: string; types?: string[]; orderBy?: string; ascending?: boolean }): Promise<{ 
    sessions: Tables<'sessions'>[]; 
    sessionStudents: Record<string, Array<Tables<'students'> & {
      planned_absence?: boolean;
      actual_attended?: boolean | null;
      actual_was_trial?: boolean | null;
      invoice_status_payload?: import('@/features/billing/utils/invoiceFormatters').InvoiceStatusPayload | null;
      sessions_students_id?: string | null;
      is_extra?: boolean;
      was_trial?: boolean;
      is_rescheduled?: boolean;
      is_credited?: boolean;
      rescheduled_session?: {
        session?: {
          id: string;
          start_at?: string;
          class?: {
            start_time?: string | null;
          } | null;
        } | null;
      } | null;
    }>>;
    sessionStaff: Record<string, Array<Tables<'staff'> & {
      planned_absence?: boolean;
      actual_attended?: boolean | null;
      actual_was_trial?: boolean | null;
      actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
      is_swapped_in?: boolean;
      is_swapped?: boolean;
      swapped_staff?: {
        id: string;
        first_name: string;
        last_name: string;
      } | null;
      sessions_staff_id?: string | null;
      was_trial?: boolean;
    }>>;
    tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;
    classesById: Record<string, Tables<'classes'>>;
    subjectsById: Record<string, Tables<'subjects'>>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Convert date strings to timestamptz for RPC
      // Interpret dates as local timezone and convert to UTC
      const rangeStart = args?.rangeStart ? dateStringToUtcStart(args.rangeStart) : null;
      const rangeEnd = args?.rangeEnd ? dateStringToUtcEnd(args.rangeEnd) : null;
      
      // Determine status filter
      const statuses = args?.includeInactive ? ['ACTIVE', 'INACTIVE'] : ['ACTIVE'];
      
      // Prepare search term (trim if provided)
      const searchTerm = args?.search?.trim();
      
      // Call RPC function with high limit to get all sessions
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
        p_search: searchTerm && searchTerm.length > 0 ? searchTerm : undefined,
        p_range_start: rangeStart || undefined,
        p_range_end: rangeEnd || undefined,
        p_staff_id: args?.staffId || undefined,
        p_class_id: args?.classId || undefined,
        p_student_id: args?.studentId || undefined,
        p_admin_shift_id: args?.adminShiftId || undefined,
        p_statuses: statuses,
        p_types: args?.types || undefined,
        p_include_relationships: true,
        p_limit: 10000, // High limit to get all sessions
        p_offset: 0,
        p_order_by: args?.orderBy || 'start_at',
        p_ascending: args?.ascending !== undefined ? args.ascending : true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) {
        return {
          sessions: [],
          sessionStudents: {},
          sessionStaff: {},
          tutorLogs: {},
          classesById: {},
          subjectsById: {},
        };
      }
      
      // Transform RPC response to match expected format
      const rpcData = rpcResult as SearchSessionsRpcResponse;
      
      // Transform sessions
      const sessions = (rpcData.sessions || []) as Tables<'sessions'>[];
      
      // Transform sessionStudents - RPC returns full student objects with additional fields
      const sessionStudents: Record<string, Array<Tables<'students'> & {
        planned_absence?: boolean;
        actual_attended?: boolean | null;
        actual_was_trial?: boolean | null;
        invoice_status_payload?: import('@/features/billing/utils/invoiceFormatters').InvoiceStatusPayload | null;
        sessions_students_id?: string | null;
        is_extra?: boolean;
        was_trial?: boolean;
        is_rescheduled?: boolean;
        is_credited?: boolean;
        rescheduled_session?: {
          session?: {
            id: string;
            start_at?: string;
            class?: {
              start_time?: string | null;
            } | null;
          } | null;
        } | null;
      }>> = {};
      Object.entries(rpcData.sessionStudents || {}).forEach(([sessionId, students]) => {
        sessionStudents[sessionId] = (students || []).map((s) => {
          const studentWithExtra = s as typeof s & {
            actual_was_trial?: boolean | null;
            was_trial?: boolean;
            is_rescheduled?: boolean;
            is_credited?: boolean;
            sessions_students_id?: string | null;
            rescheduled_session?: {
              session?: {
                id: string;
                start_at?: string;
                class?: {
                  start_time?: string | null;
                } | null;
              } | null;
            } | null;
          };
          const mapped = {
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            status: s.status,
            curriculum: s.curriculum,
            year_level: s.year_level,
            school: s.school,
            planned_absence: s.planned_absence ?? false,
            actual_attended: s.actual_attended ?? null,
            actual_was_trial: studentWithExtra.actual_was_trial ?? null,
            invoice_status_payload: (s as { invoice_status_payload?: unknown }).invoice_status_payload ?? null,
            sessions_students_id: studentWithExtra.sessions_students_id ?? null,
            is_extra: s.is_extra ?? false,
            was_trial: studentWithExtra.was_trial ?? false,
            is_rescheduled: studentWithExtra.is_rescheduled ?? false,
            is_credited: studentWithExtra.is_credited ?? false,
            rescheduled_session: studentWithExtra.rescheduled_session ?? null,
          };
          return mapped;
        }) as Array<Tables<'students'> & {
          planned_absence?: boolean;
          actual_attended?: boolean | null;
          actual_was_trial?: boolean | null;
          invoice_status_payload?: import('@/features/billing/utils/invoiceFormatters').InvoiceStatusPayload | null;
          sessions_students_id?: string | null;
          is_extra?: boolean;
          was_trial?: boolean;
          is_rescheduled?: boolean;
          is_credited?: boolean;
          rescheduled_session?: {
            session?: {
              id: string;
              start_at?: string;
              class?: {
                start_time?: string | null;
              } | null;
            } | null;
          } | null;
        }>;
      });
      
      // Transform sessionStaff - RPC returns full staff objects with additional fields
      const sessionStaff: Record<string, Array<Tables<'staff'> & {
        planned_absence?: boolean;
        actual_attended?: boolean | null;
        actual_was_trial?: boolean | null;
        actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
        is_swapped_in?: boolean;
        is_swapped?: boolean;
        swapped_staff?: {
          id: string;
          first_name: string;
          last_name: string;
        } | null;
        sessions_staff_id?: string | null;
        was_trial?: boolean;
      }>> = {};
      Object.entries(rpcData.sessionStaff || {}).forEach(([sessionId, staff]) => {
        sessionStaff[sessionId] = (staff || []).map((s) => {
          const staffWithExtra = s as typeof s & {
            actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
            actual_was_trial?: boolean | null;
            is_swapped?: boolean;
            was_trial?: boolean;
            swapped_staff?: {
              id: string;
              first_name: string;
              last_name: string;
            } | null;
            sessions_staff_id?: string | null;
          };
          return {
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            role: s.role,
            status: s.status,
            planned_absence: s.planned_absence ?? false,
            actual_attended: s.actual_attended ?? null,
            actual_was_trial: staffWithExtra.actual_was_trial ?? null,
            actual_type: staffWithExtra.actual_type ?? null,
            is_swapped_in: s.is_swapped_in ?? false,
            is_swapped: staffWithExtra.is_swapped ?? false,
            swapped_staff: staffWithExtra.swapped_staff ?? null,
            sessions_staff_id: staffWithExtra.sessions_staff_id ?? null,
            was_trial: staffWithExtra.was_trial ?? false,
          };
        }) as Array<Tables<'staff'> & {
          planned_absence?: boolean;
          actual_attended?: boolean | null;
          actual_was_trial?: boolean | null;
          actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
          is_swapped_in?: boolean;
          is_swapped?: boolean;
          swapped_staff?: {
            id: string;
            first_name: string;
            last_name: string;
          } | null;
          sessions_staff_id?: string | null;
          was_trial?: boolean;
        }>;
      });
      
      // Transform tutorLogs
      const tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }> = {};
      Object.entries(rpcData.tutorLogs || {}).forEach(([sessionId, log]) => {
        if (log) {
          tutorLogs[sessionId] = {
            id: log.id,
            created_by: log.created_by,
            created_by_name: log.created_by_name || { first_name: '', last_name: '' },
          };
        }
      });
      
      // Transform classesById and subjectsById (already in correct format from RPC)
      const classesById = (rpcData.classesById || {}) as Record<string, Tables<'classes'>>;
      const subjectsById = (rpcData.subjectsById || {}) as Record<string, Tables<'subjects'>>;
      
      // Initialize empty arrays for sessions with no students/staff
      sessions.forEach(session => {
        if (!sessionStudents[session.id]) {
          sessionStudents[session.id] = [];
        }
        if (!sessionStaff[session.id]) {
          sessionStaff[session.id] = [];
        }
      });
      
      return {
        sessions,
        sessionStudents,
        sessionStaff,
        tutorLogs,
        classesById,
        subjectsById,
      };
      
    } catch (error) {
      console.error('Error getting sessions with details:', error);
      throw error;
    }
  },

  /**
   * Get a single session with its details in an optimized query
   */
  getSessionWithDetails: async (sessionId: string): Promise<{
    session: Tables<'sessions'> | null;
    students: Tables<'students'>[];
    staff: Tables<'staff'>[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          return { session: null, students: [], staff: [] };
        }
        throw sessionError;
      }
      
      // Get session students
      const { data: studentsData, error: studentsError } = await supabase
        .from('sessions_students')
        .select(`
          student:students(*)
        `)
        .eq('session_id', sessionId);
      
      if (studentsError) throw studentsError;
      
      // Get session staff
      const { data: staffData, error: staffError } = await supabase
        .from('sessions_staff')
        .select(`staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name, email, phone_number, status, role)`)
        .eq('session_id', sessionId);
      
      if (staffError) throw staffError;
      
      // Transform data
      const session = sessionData as Tables<'sessions'>;
      const students = (studentsData as SessionWithRelationsRow[] | null)
        ?.map((row) => row.student)
        .filter((student): student is Tables<'students'> => student !== null) || [];
      const staff = (staffData as SessionStaffWithRelationsRow[] | null)
        ?.map((row) => row.staff)
        .filter((staffMember): staffMember is Tables<'staff'> => staffMember !== null) || [];
      
      return { session, students, staff };
      
    } catch (error) {
      console.error('Error getting session with details:', error);
      throw error;
    }
  },

  /**
   * Get a session by ID
   */
  getSession: async (id: string): Promise<Tables<'sessions'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'sessions'> | null;
  },

  /**
   * Create a new session
   */
  createSession: async (data: TablesInsert<'sessions'>): Promise<Tables<'sessions'>> => {
    // Ensure the user is an admin first
    
    const { data: created, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions').insert(data).select().single();
    if (error) throw error;
    return created as Tables<'sessions'>;
  },

  /**
   * Update a session
   */
  updateSession: async (id: string, data: TablesUpdate<'sessions'>): Promise<Tables<'sessions'>> => {
    // Ensure the user is an admin first
    
    const { data: updated, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated as Tables<'sessions'>;
  },

  /**
   * Delete a session
   */
  deleteSession: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Add a student to a session (planned attendance)
   */
  addStudentToSession: async (sessionId: string, studentId: string): Promise<Tables<'sessions_students'>> => {
    try {
      const payload: TablesInsert<'sessions_students'> = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        student_id: studentId,
      };
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_students').insert(payload).select().single();
      if (error) throw error;
      return data as Tables<'sessions_students'>;
    } catch (error) {
      console.error('Error adding student to session:', error);
      throw error;
    }
  },

  /**
   * Remove a student from a session
   */
  removeStudentFromSession: async (sessionId: string, studentId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      
      // Find the attendance record
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_students').select('id').eq('session_id', sessionId).eq('student_id', studentId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_students').delete().eq('session_id', sessionId).eq('student_id', studentId);
        if (delError) throw delError;
      }
    } catch (error) {
      console.error('Error removing student from session:', error);
      throw error;
    }
  },

  /**
   * Assign a staff member to a session
   */
  assignStaffToSession: async (sessionId: string, staffId: string, type: string = 'MAIN_TUTOR'): Promise<Tables<'sessions_staff'>> => {
    try {
      const payload: TablesInsert<'sessions_staff'> = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        staff_id: staffId,
        type: type as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR',
      };
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_staff').insert(payload).select().single();
      if (error) throw error;
      return data as Tables<'sessions_staff'>;
    } catch (error) {
      console.error('Error assigning staff to session:', error);
      throw error;
    }
  },

  /**
   * Remove a staff member from a session
   */
  removeStaffFromSession: async (sessionId: string, staffId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      
      // Find the assignment record
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_staff').select('id').eq('session_id', sessionId).eq('staff_id', staffId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_staff').delete().eq('session_id', sessionId).eq('staff_id', staffId);
        if (delError) throw delError;
      }
    } catch (error) {
      console.error('Error removing staff from session:', error);
      throw error;
    }
  },

  addParentToSession: async (sessionId: string, parentId: string): Promise<Tables<'sessions_parents'>> => {
    const payload: TablesInsert<'sessions_parents'> = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      parent_id: parentId,
    };
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('sessions_parents')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Tables<'sessions_parents'>;
  },

  removeParentFromSession: async (sessionId: string, parentId: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('sessions_parents')
      .delete()
      .eq('session_id', sessionId)
      .eq('parent_id', parentId);
    if (error) throw error;
  },


  /**
   * Get sessions for a specific student using RPC
   */
  getSessionsForStudent: async (studentId: string, includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const statuses = includeInactive ? ['ACTIVE', 'INACTIVE'] : ['ACTIVE'];
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
        p_search: undefined,
        p_range_start: undefined,
        p_range_end: undefined,
        p_staff_id: undefined,
        p_class_id: undefined,
        p_student_id: studentId,
        p_statuses: statuses,
        p_types: undefined,
        p_include_relationships: false, // Don't need relationships for this query
        p_limit: 10000, // High limit to get all sessions
        p_offset: 0,
        p_order_by: 'start_at',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return [];
      
      const rpcData = rpcResult as { sessions: Tables<'sessions'>[]; total: number };
      return (rpcData.sessions || []) as Tables<'sessions'>[];
    } catch (error) {
      console.error('Error getting sessions for student:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific staff member using RPC
   */
  getSessionsForStaff: async (staffId: string, includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const statuses = includeInactive ? ['ACTIVE', 'INACTIVE'] : ['ACTIVE'];
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
        p_search: undefined,
        p_range_start: undefined,
        p_range_end: undefined,
        p_staff_id: staffId,
        p_class_id: undefined,
        p_student_id: undefined,
        p_statuses: statuses,
        p_types: undefined,
        p_include_relationships: false, // Don't need relationships for this query
        p_limit: 10000, // High limit to get all sessions
        p_offset: 0,
        p_order_by: 'start_at',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return [];
      
      const rpcData = rpcResult as { sessions: Tables<'sessions'>[]; total: number };
      return (rpcData.sessions || []) as Tables<'sessions'>[];
    } catch (error) {
      console.error('Error getting sessions for staff:', error);
      throw error;
    }
  },

  /**
   * Get planned participants for a session
   */
  getSessionAttendanceDetails: async (sessionId: string): Promise<{
    plannedStudents: Tables<'students'>[];
    plannedStaff: Tables<'staff'>[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // sessions_students with joined students (only those without planned_absence)
    const { data: ssRows, error: ssErr } = await supabase
      .from('sessions_students')
      .select('planned_absence, student:students(*)')
      .eq('session_id', sessionId);
    if (ssErr) throw ssErr;

    const plannedStudents = (ssRows as SessionStudentRow[] | null ?? [])
      .filter((r): r is SessionStudentRow & { student: Tables<'students'> } => !r.planned_absence && r.student !== null)
      .map((r) => r.student);

    // sessions_staff with joined staff (only those without planned_absence)
    const { data: sfRows, error: sfErr } = await supabase
      .from('sessions_staff')
      .select('planned_absence, staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name, email, phone_number, status, role)')
      .eq('session_id', sessionId);
    if (sfErr) throw sfErr;
    
    const plannedStaff = (sfRows as SessionStaffRow[] | null ?? [])
      .filter((r): r is SessionStaffRow & { staff: Tables<'staff'> } => !r.planned_absence && r.staff !== null)
      .map((r) => r.staff);

    return { plannedStudents, plannedStaff };
  },

  /**
   * Get comprehensive session details including tutor logs
   */
  getSessionWithTutorLog: async (sessionId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // 1. Get session with class and subject (both session's subject and class's subject)
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          subject:subjects(*),
          class:classes(
            *,
            subject:subjects(*)
          )
        `)
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;
      
      // 2. Get all sessions_students with full details
      const { data: sessionsStudentsData, error: ssError } = await supabase
        .from('sessions_students')
        .select(`
          *,
          student:students(*)
        `)
        .eq('session_id', sessionId);
      
      if (ssError) throw ssError;
      
      // Fetch rescheduled sessions separately if needed
      const typedSessionsStudentsData = (sessionsStudentsData || []) as SessionStudentWithDetails[];
      const rescheduledIds = typedSessionsStudentsData
        .filter((ss) => ss.rescheduled_sessions_students_id)
        .map((ss) => ss.rescheduled_sessions_students_id)
        .filter((id): id is string => id !== null && id !== undefined);
      
      const rescheduledSessionsMap: Record<string, RescheduledSessionRow> = {};
      if (rescheduledIds.length > 0) {
        const { data: rescheduledData, error: reschedError } = await supabase
          .from('sessions_students')
          .select(`
            id,
            session:sessions(
              *,
              class:classes(*)
            )
          `)
          .in('id', rescheduledIds);
        
        if (reschedError) throw reschedError;
        
        (rescheduledData as RescheduledSessionRow[] || []).forEach((rd) => {
          rescheduledSessionsMap[rd.id] = rd;
        });
      }
      
      // Fetch invoice status for sessions_students
      const sessionsStudentsIds = typedSessionsStudentsData.map((ss) => ss.id).filter(Boolean);
      const { data: invoiceItemsData, error: invoiceItemsError } = sessionsStudentsIds.length > 0
        ? await supabase
            .from('invoice_items')
            .select(
              'sessions_students_id, invoice:invoices(status, paid_at, refunded_at, refunded_via_cn_at, credited_at, deleted_at)'
            )
            .in('sessions_students_id', sessionsStudentsIds)
            .is('deleted_at', null)
        : { data: [], error: null };

      if (invoiceItemsError) throw invoiceItemsError;

      // Build invoice_status_payload map for centralized badge display
      type InvoicePayload = {
        status: string;
        paid_at?: string | null;
        refunded_at?: string | null;
        refunded_via_cn_at?: string | null;
        credited_at?: string | null;
      };
      const invoiceStatusPayloadMap: Record<string, InvoicePayload | null> = {};
      (
        invoiceItemsData as Array<{
          sessions_students_id?: string | null;
          invoice?: { status?: string; paid_at?: string | null; refunded_at?: string | null; refunded_via_cn_at?: string | null; credited_at?: string | null; deleted_at?: string | null } | null;
        }> | null
      )?.forEach((row) => {
        if (row.sessions_students_id && row.invoice && !(row.invoice as { deleted_at?: string | null }).deleted_at) {
          const inv = row.invoice;
          invoiceStatusPayloadMap[row.sessions_students_id] = {
            status: inv.status ?? 'draft',
            paid_at: inv.paid_at ?? null,
            refunded_at: inv.refunded_at ?? null,
            refunded_via_cn_at: inv.refunded_via_cn_at ?? null,
            credited_at: inv.credited_at ?? null,
          };
        }
      });

      // Calculate is_extra flag: student is extra if session has class_id but student is not enrolled
      const session = sessionData as Tables<'sessions'>;
      const isExtraMap: Record<string, boolean> = {};
      
      if (session.class_id && typedSessionsStudentsData && typedSessionsStudentsData.length > 0) {
        const studentIds = typedSessionsStudentsData.map((ss) => ss.student_id).filter(Boolean);
        const sessionStartAt = session.start_at ? new Date(session.start_at) : null;
        
        // Fetch class enrollments for these students
        const { data: enrollmentsData, error: enrollError } = await supabase
          .from('classes_students')
          .select('student_id, unenrolled_at')
          .eq('class_id', session.class_id)
          .in('student_id', studentIds);
        
        if (!enrollError && enrollmentsData) {
          // Build map of enrolled students (enrolled and not unenrolled before session)
          const enrolledStudentIds = new Set<string>();
          (enrollmentsData as EnrollmentRow[]).forEach((enrollment) => {
            if (!enrollment.unenrolled_at || (sessionStartAt && new Date(enrollment.unenrolled_at) > sessionStartAt)) {
              enrolledStudentIds.add(enrollment.student_id);
            }
          });
          
          // Mark students as extra if they're not enrolled
          typedSessionsStudentsData.forEach((ss) => {
            if (ss.student_id && !enrolledStudentIds.has(ss.student_id)) {
              isExtraMap[ss.id] = true;
            } else {
              isExtraMap[ss.id] = false;
            }
          });
        } else {
          // If error fetching enrollments, assume all students are extra if class_id exists
          typedSessionsStudentsData.forEach((ss) => {
            isExtraMap[ss.id] = session.class_id ? true : false;
          });
        }
      } else {
        const treatAllStudentsAsExtra =
          session.type !== 'CLASS' && !session.class_id;
        typedSessionsStudentsData?.forEach((ss) => {
          isExtraMap[ss.id] = treatAllStudentsAsExtra;
        });
      }

      // Attach rescheduled session data, invoice status, and is_extra flag to sessions_students
      const enrichedSessionsStudentsData = typedSessionsStudentsData.map((ss) => ({
        ...ss,
        sessions_students_id: ss.id, // Map id to sessions_students_id for UI consistency
        rescheduled_session: ss.rescheduled_sessions_students_id
          ? rescheduledSessionsMap[ss.rescheduled_sessions_students_id]
          : null,
        invoice_status_payload: invoiceStatusPayloadMap[ss.id] || null,
        is_extra: isExtraMap[ss.id] || false,
      }));
      
      // Get tutor log to check for unplanned students who attended
      const { data: tutorLogDataForUnplanned, error: tlErrorForUnplanned } = await supabase
        .from('tutor_logs')
        .select('id, created_by')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      // If tutor log exists, get unplanned students (students who attended but aren't in sessions_students)
      type UnplannedStudent = {
        student_id: string;
        student: Tables<'students'>;
        planned_absence: boolean;
        is_extra: boolean;
        sessions_students_id: null;
        invoice_status_payload: null;
        rescheduled_session: null;
      };
      const unplannedStudents: UnplannedStudent[] = [];
      if (tutorLogDataForUnplanned && !tlErrorForUnplanned) {
        const { data: studentAttendanceData, error: saError } = await supabase
          .from('tutor_logs_student_attendance')
          .select('*, student:students(*)')
          .eq('tutor_log_id', tutorLogDataForUnplanned.id)
          .eq('attended', true);
        
        if (!saError && studentAttendanceData) {
          // Get student IDs that are already in sessions_students
          const plannedStudentIds = new Set(
            typedSessionsStudentsData.map((ss) => ss.student_id).filter(Boolean)
          );
          
          // Find students who attended but aren't in sessions_students
          (studentAttendanceData as Array<{ student: Tables<'students'> | null; attended: boolean }>).forEach((att) => {
            if (att.student && att.student.id && !plannedStudentIds.has(att.student.id)) {
              unplannedStudents.push({
                student_id: att.student.id,
                student: att.student,
                planned_absence: false,
                is_extra: true, // These are always extra since they're not planned
                sessions_students_id: null, // Explicitly null to mark as unplanned
                invoice_status_payload: null,
                rescheduled_session: null,
              });
            }
          });
        }
      }
      
      // Combine planned and unplanned students
      const allSessionsStudents = [...enrichedSessionsStudentsData, ...unplannedStudents];
      
      // 3. Get all sessions_staff with full details  
      const { data: sessionsStaffData, error: sfError } = await supabase
        .from('sessions_staff')
        .select(`
          *,
          staff:staff!sessions_staff_staff_id_fkey(*)
        `)
        .eq('session_id', sessionId);
      
      if (sfError) throw sfError;
      
      // Fetch swapped staff separately if needed
      const typedSessionsStaffData = (sessionsStaffData || []) as SessionStaffWithDetails[];
      const swappedStaffIds = typedSessionsStaffData
        .filter((sf) => sf.swapped_sessions_staff_id)
        .map((sf) => sf.swapped_sessions_staff_id)
        .filter((id): id is string => id !== null && id !== undefined);
      
      const swappedStaffMap: Record<string, Tables<'staff'>> = {};
      if (swappedStaffIds.length > 0) {
        const { data: swappedData, error: swapError } = await supabase
          .from('sessions_staff')
          .select(`
            id,
            staff:staff!sessions_staff_staff_id_fkey(*)
          `)
          .in('id', swappedStaffIds);
        
        if (swapError) throw swapError;
        
        (swappedData as Array<{ id: string; staff: Tables<'staff'> | null }> || []).forEach((sd) => {
          if (sd.staff) {
            swappedStaffMap[sd.id] = sd.staff;
          }
        });
      }
      
      // Attach swapped staff data to sessions_staff
      const enrichedSessionsStaffData = typedSessionsStaffData.map((sf) => ({
        ...sf,
        swapped_staff: sf.swapped_sessions_staff_id
          ? swappedStaffMap[sf.swapped_sessions_staff_id]
          : null,
      }));
      
      // 4. Get tutor log if it exists
      const { data: tutorLogData, error: tlError } = await supabase
        .from('tutor_logs')
        .select('*, created_by_staff:staff!created_by(id, first_name, last_name)')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (tlError) throw tlError;
      
      let tutorLog = null;
      
      if (tutorLogData) {
        // Get tutor log student attendance
        const { data: studentAttendanceData, error: saError } = await supabase
          .from('tutor_logs_student_attendance')
          .select('*, student:students(*)')
          .eq('tutor_log_id', tutorLogData.id);
        
        if (saError) throw saError;
        
        // Get tutor log staff attendance
        const { data: staffAttendanceData, error: stfError } = await supabase
          .from('tutor_logs_staff_attendance')
          .select('*, staff:staff(*)')
          .eq('tutor_log_id', tutorLogData.id);
        
        if (stfError) throw stfError;

        const { data: parentAttendanceData, error: parentAttError } = await supabase
          .from('tutor_logs_parent_attendance')
          .select('*, parent:parents(*)')
          .eq('tutor_log_id', tutorLogData.id);

        if (parentAttError) throw parentAttError;
        
        // Get tutor log topics with related data
        const { data: topicsData, error: topicsError } = await supabase
          .from('tutor_logs_topics')
          .select('*, topic:topics(*)')
          .eq('tutor_log_id', tutorLogData.id);
        
        if (topicsError) throw topicsError;
        
        // Get topic-student links
        const typedTopicsData = (topicsData || []) as TutorLogTopicRow[];
        const topicIds = typedTopicsData.map((t) => t.id);
        const { data: topicStudentsData, error: tsError } = topicIds.length > 0 ? await supabase
          .from('tutor_logs_topics_students')
          .select('*, student:students(*)')
          .in('tutor_logs_topics_id', topicIds)
          : { data: [], error: null };
        
        if (tsError) throw tsError;
        
        // Get tutor log files
        const { data: filesData, error: filesError } = await supabase
          .from('tutor_logs_topics_files')
          .select('*, topics_file:topics_files(*, file:files(*))')
          .eq('tutor_log_id', tutorLogData.id);
        
        if (filesError) throw filesError;
        
        // Get file-student links
        const typedFilesData = (filesData || []) as TutorLogTopicFileRow[];
        const fileIds = typedFilesData.map((f) => f.id);
        const { data: fileStudentsData, error: fsError } = fileIds.length > 0 ? await supabase
          .from('tutor_logs_topics_files_students')
          .select('*, student:students(*)')
          .in('tutor_logs_topics_files_id', fileIds)
          : { data: [], error: null };
        
        if (fsError) throw fsError;
        
        // Build tutor log structure
        const typedTopicStudentsData = (topicStudentsData || []) as TutorLogTopicStudentRow[];
        const typedFileStudentsData = (fileStudentsData || []) as TutorLogTopicFileStudentRow[];
        tutorLog = {
          ...tutorLogData,
          studentAttendance: (studentAttendanceData || []) as TutorLogStudentAttendanceRow[],
          staffAttendance: (staffAttendanceData || []) as TutorLogStaffAttendanceRow[],
          parentAttendance: (parentAttendanceData || []) as TutorLogParentAttendanceRow[],
          topics: typedTopicsData.map((topic) => ({
            ...topic,
            students: typedTopicStudentsData
              .filter((ts) => ts.tutor_logs_topics_id === topic.id && ts.student)
              .map((ts) => ts.student!)
              .filter((student): student is Tables<'students'> => student !== null),
            files: typedFilesData
              .filter((f) => f.topics_file && f.topics_file.topic_id === topic.topic?.id)
              .map((file) => ({
                ...file,
                students: typedFileStudentsData
                  .filter((fs) => fs.tutor_logs_topics_files_id === file.id && fs.student)
                  .map((fs) => fs.student!)
                  .filter((student): student is Tables<'students'> => student !== null),
              })),
          })),
        };
      }
      
      // 5. Get notes for session (includes notes added from tutor log flow; stored as target_type = sessions)
      const { data: sessionNotesData, error: sessionNotesError } = await supabase
        .from('notes')
        .select('*, staff:created_by(*)')
        .eq('target_type', 'sessions')
        .eq('target_id', sessionId)
        .order('created_at', { ascending: true });
      
      if (sessionNotesError) throw sessionNotesError;

      const { data: sessionsParentsData, error: sessionsParentsError } = await supabase
        .from('sessions_parents')
        .select('*, parent:parents(*)')
        .eq('session_id', sessionId);

      if (sessionsParentsError) throw sessionsParentsError;

      return {
        session: sessionData,
        sessionsStudents: allSessionsStudents || [],
        sessionsStaff: enrichedSessionsStaffData || [],
        sessionsParents: (sessionsParentsData || []) as Array<
          Tables<'sessions_parents'> & { parent: Tables<'parents'> | null }
        >,
        tutorLog,
        notes: (sessionNotesData || []) as NoteWithStaff[],
      };
    } catch (error) {
      console.error('Error getting session with tutor log:', error);
      throw error;
    }
  },
}; 
