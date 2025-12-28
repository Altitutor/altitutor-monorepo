import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sessions API client for working with session data
 */
export const sessionsApi = {
  /**
   * Get all sessions
   */
  getAllSessions: async (includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    let query = (getSupabaseClient() as SupabaseClient<Database>).from('sessions').select('*');
    if (!includeInactive) {
      query = query.eq('status', 'ACTIVE');
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Tables<'sessions'>[];
  },

  /**
   * Get all sessions with their attendees and staff in an optimized single query
   * This solves the N+1 query problem for the sessions table
   */
  getAllSessionsWithDetails: async (args?: { rangeStart?: string; rangeEnd?: string; includeInactive?: boolean }): Promise<{ 
    sessions: Tables<'sessions'>[]; 
    sessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; actual_attended?: boolean | null; invoice_status?: string | null; sessions_students_id?: string }>>;
    sessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; actual_attended?: boolean | null }>>;
    tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;
    classesById: Record<string, Tables<'classes'>>;
    subjectsById: Record<string, Tables<'subjects'>>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get sessions in range if provided (server-side filtering)
      let query = supabase.from('sessions').select('*');
      if (!args?.includeInactive) {
        query = query.eq('status', 'ACTIVE');
      }
      if (args?.rangeStart) {
        const startIso = `${args.rangeStart}T00:00:00Z`;
        query = query.gte('start_at', startIso);
      }
      if (args?.rangeEnd) {
        const endIso = `${args.rangeEnd}T23:59:59Z`;
        query = query.lte('start_at', endIso);
      }
      const { data: allSessions, error: sessionsError } = await query;
      
      if (sessionsError) throw sessionsError;
      
      // Transform sessions data
      const sessions = (allSessions ?? []) as Tables<'sessions'>[];
      const sessionIds = sessions.map(s => s.id);
      
      // Early return if no sessions found
      if (sessionIds.length === 0) {
        return {
          sessions: [],
          sessionStudents: {},
          sessionStaff: {},
          tutorLogs: {},
          classesById: {},
          subjectsById: {},
        };
      }
      
      // Get session students with student details and invoice status (using JOIN)
      // Filter by session IDs to only fetch records for sessions we retrieved
      const { data: sessionStudentsData, error: studentsError } = await supabase
        .from('sessions_students')
        .select(`
          id,
          session_id,
          planned_absence,
          student_id,
          student:students(id, first_name, last_name),
          invoice_items:invoice_items(
            invoice:invoices(status)
          )
        `)
        .in('session_id', sessionIds);
      
      if (studentsError) throw studentsError;
      
      // Get session staff with staff details (planned attendance only)
      // Filter by session IDs to only fetch records for sessions we retrieved
      const { data: sessionStaffData, error: staffError } = await supabase
        .from('sessions_staff')
        .select(`session_id, staff_id, planned_absence, staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name)`)
        .in('session_id', sessionIds);
      
      if (staffError) throw staffError;
      
      // Collect referenced IDs
      const classIds = Array.from(new Set(sessions.map(s => s.class_id).filter(Boolean))) as string[];
      const subjectIdsFromSessions = Array.from(new Set(sessions.map(s => s.subject_id).filter(Boolean))) as string[];

      // Fetch classes first
      const classesRes = classIds.length
        ? await supabase.from('classes').select('*').in('id', classIds)
        : { data: [] as any[], error: null as any };

      if ((classesRes as any).error) throw (classesRes as any).error;

      const classesById: Record<string, Tables<'classes'>> = {};
      for (const row of (classesRes as any).data as Tables<'classes'>[]) {
        classesById[row.id] = row;
      }

      // Collect subject IDs from both sessions AND classes (classes reference subjects too)
      const subjectIdsFromClasses = Array.from(
        new Set(
          Object.values(classesById)
            .map(cls => cls.subject_id)
            .filter(Boolean)
        )
      ) as string[];
      
      // Combine subject IDs from sessions and classes
      const allSubjectIds = Array.from(new Set([...subjectIdsFromSessions, ...subjectIdsFromClasses]));

      // Fetch all referenced subjects
      const subjectsRes = allSubjectIds.length
        ? await supabase.from('subjects').select('*').in('id', allSubjectIds)
        : { data: [] as any[], error: null as any };

      if ((subjectsRes as any).error) throw (subjectsRes as any).error;

      const subjectsById: Record<string, Tables<'subjects'>> = {};
      for (const row of (subjectsRes as any).data as Tables<'subjects'>[]) {
        subjectsById[row.id] = row;
      }

      // Fetch tutor logs with created_by staff info
      const { data: tutorLogsData, error: tutorLogsError } = await supabase
        .from('tutor_logs')
        .select(`
          id,
          session_id,
          created_by,
          staff:staff!tutor_logs_created_by_fkey(id, first_name, last_name)
        `)
        .in('session_id', sessionIds);
      
      if (tutorLogsError) throw tutorLogsError;

      // Build tutor logs map
      const tutorLogsMap: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }> = {};
      tutorLogsData?.forEach((row: any) => {
        if (row.session_id && row.staff) {
          tutorLogsMap[row.session_id] = {
            id: row.id,
            created_by: row.created_by,
            created_by_name: {
              first_name: row.staff.first_name,
              last_name: row.staff.last_name,
            },
          };
        }
      });

      // Get tutor log IDs for fetching attendance
      const tutorLogIds = tutorLogsData?.map(tl => tl.id) || [];

      // Fetch actual student attendance from tutor logs (using JOIN to tutor_logs)
      const { data: studentAttendanceData, error: studentAttendanceError } = tutorLogIds.length > 0
        ? await supabase
            .from('tutor_logs_student_attendance')
            .select(`
              tutor_log_id,
              student_id,
              attended,
              tutor_log:tutor_logs(session_id)
            `)
            .in('tutor_log_id', tutorLogIds)
        : { data: [], error: null };
      
      if (studentAttendanceError) throw studentAttendanceError;

      // Fetch actual staff attendance from tutor logs (using JOIN to tutor_logs)
      const { data: staffAttendanceData, error: staffAttendanceError } = tutorLogIds.length > 0
        ? await supabase
            .from('tutor_logs_staff_attendance')
            .select(`
              tutor_log_id,
              staff_id,
              attended,
              tutor_log:tutor_logs(session_id)
            `)
            .in('tutor_log_id', tutorLogIds)
        : { data: [], error: null };
      
      if (staffAttendanceError) throw staffAttendanceError;

      // Build actual attendance maps
      // Map: session_id -> student_id -> attended
      const actualStudentAttendanceMap: Record<string, Record<string, boolean>> = {};
      // Map: session_id -> staff_id -> attended
      const actualStaffAttendanceMap: Record<string, Record<string, boolean>> = {};

      // Process student attendance (using session_id from JOIN)
      studentAttendanceData?.forEach((row: any) => {
        const sessionId = row.tutor_log?.session_id;
        if (sessionId && row.student_id) {
          if (!actualStudentAttendanceMap[sessionId]) {
            actualStudentAttendanceMap[sessionId] = {};
          }
          actualStudentAttendanceMap[sessionId][row.student_id] = row.attended;
        }
      });

      // Process staff attendance (using session_id from JOIN)
      staffAttendanceData?.forEach((row: any) => {
        const sessionId = row.tutor_log?.session_id;
        if (sessionId && row.staff_id) {
          if (!actualStaffAttendanceMap[sessionId]) {
            actualStaffAttendanceMap[sessionId] = {};
          }
          actualStaffAttendanceMap[sessionId][row.staff_id] = row.attended;
        }
      });

      // Build session students map (including all students with planned_absence status)
      // Invoice status is now included via JOIN in the query above
      const sessionStudentsMap: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; actual_attended?: boolean | null; invoice_status?: string | null; sessions_students_id?: string }>> = {};
      sessionStudentsData?.forEach((row: any) => {
        if (row.session_id && row.student) {
          if (!sessionStudentsMap[row.session_id]) {
            sessionStudentsMap[row.session_id] = [];
          }
          const actualAttended = actualStudentAttendanceMap[row.session_id]?.[row.student_id] ?? null;
          // Extract invoice status from JOIN (invoice_items is an array, take first if exists)
          const invoiceStatus = row.invoice_items && row.invoice_items.length > 0
            ? row.invoice_items[0]?.invoice?.status || null
            : null;
          sessionStudentsMap[row.session_id].push({
            ...(row.student as Tables<'students'>),
            planned_absence: row.planned_absence || false,
            actual_attended: actualAttended,
            invoice_status: invoiceStatus,
            sessions_students_id: row.id,
          });
        }
      });

      // Collect student IDs from actual attendance who are not in planned
      const unplannedStudentIds = new Set<string>();
      Object.keys(actualStudentAttendanceMap).forEach(sessionId => {
        const actualAttendance = actualStudentAttendanceMap[sessionId];
        Object.keys(actualAttendance).forEach(studentId => {
          const existsInPlanned = sessionStudentsMap[sessionId]?.some(
            s => s.id === studentId
          );
          if (!existsInPlanned) {
            unplannedStudentIds.add(studentId);
          }
        });
      });

      // Fetch student details for unplanned students
      const unplannedStudentsMap: Record<string, Tables<'students'>> = {};
      if (unplannedStudentIds.size > 0) {
        const { data: unplannedStudentsData, error: unplannedStudentsError } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', Array.from(unplannedStudentIds));
        
        if (unplannedStudentsError) throw unplannedStudentsError;
        unplannedStudentsData?.forEach((student: any) => {
          unplannedStudentsMap[student.id] = student as Tables<'students'>;
        });
      }

      // Add students from actual attendance who are not in planned attendance
      Object.keys(actualStudentAttendanceMap).forEach(sessionId => {
        const actualAttendance = actualStudentAttendanceMap[sessionId];
        Object.keys(actualAttendance).forEach(studentId => {
          const existsInPlanned = sessionStudentsMap[sessionId]?.some(
            s => s.id === studentId
          );
          if (!existsInPlanned && unplannedStudentsMap[studentId]) {
            if (!sessionStudentsMap[sessionId]) {
              sessionStudentsMap[sessionId] = [];
            }
            sessionStudentsMap[sessionId].push({
              ...unplannedStudentsMap[studentId],
              planned_absence: true, // Not in planned, so mark as absent
              actual_attended: actualAttendance[studentId],
              invoice_status: null, // No sessions_students_id, so no invoice
              sessions_students_id: undefined,
            });
          }
        });
      });
      
      // Build session staff map (including all staff with planned_absence status)
      const sessionStaffMap: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; actual_attended?: boolean | null }>> = {};
      sessionStaffData?.forEach((row: any) => {
        if (row.session_id && row.staff) {
          if (!sessionStaffMap[row.session_id]) {
            sessionStaffMap[row.session_id] = [];
          }
          const actualAttended = actualStaffAttendanceMap[row.session_id]?.[row.staff_id] ?? null;
          sessionStaffMap[row.session_id].push({
            ...(row.staff as Tables<'staff'>),
            planned_absence: row.planned_absence || false,
            actual_attended: actualAttended,
          });
        }
      });

      // Collect staff IDs from actual attendance who are not in planned
      const unplannedStaffIds = new Set<string>();
      Object.keys(actualStaffAttendanceMap).forEach(sessionId => {
        const actualAttendance = actualStaffAttendanceMap[sessionId];
        Object.keys(actualAttendance).forEach(staffId => {
          const existsInPlanned = sessionStaffMap[sessionId]?.some(
            s => s.id === staffId
          );
          if (!existsInPlanned) {
            unplannedStaffIds.add(staffId);
          }
        });
      });

      // Fetch staff details for unplanned staff
      const unplannedStaffMap: Record<string, Tables<'staff'>> = {};
      if (unplannedStaffIds.size > 0) {
        const { data: unplannedStaffData, error: unplannedStaffError } = await supabase
          .from('staff')
          .select('id, first_name, last_name')
          .in('id', Array.from(unplannedStaffIds));
        
        if (unplannedStaffError) throw unplannedStaffError;
        unplannedStaffData?.forEach((staff: any) => {
          unplannedStaffMap[staff.id] = staff as Tables<'staff'>;
        });
      }

      // Add staff from actual attendance who are not in planned attendance
      Object.keys(actualStaffAttendanceMap).forEach(sessionId => {
        const actualAttendance = actualStaffAttendanceMap[sessionId];
        Object.keys(actualAttendance).forEach(staffId => {
          const existsInPlanned = sessionStaffMap[sessionId]?.some(
            s => s.id === staffId
          );
          if (!existsInPlanned && unplannedStaffMap[staffId]) {
            if (!sessionStaffMap[sessionId]) {
              sessionStaffMap[sessionId] = [];
            }
            sessionStaffMap[sessionId].push({
              ...unplannedStaffMap[staffId],
              planned_absence: true, // Not in planned, so mark as absent
              actual_attended: actualAttendance[staffId],
            });
          }
        });
      });
      
      // Initialize empty arrays for sessions with no students/staff
      sessions.forEach(session => {
        if (!sessionStudentsMap[session.id]) {
          sessionStudentsMap[session.id] = [];
        }
        if (!sessionStaffMap[session.id]) {
          sessionStaffMap[session.id] = [];
        }
      });
      
      return {
        sessions,
        sessionStudents: sessionStudentsMap,
        sessionStaff: sessionStaffMap,
        tutorLogs: tutorLogsMap,
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
      const students = studentsData
        ?.map((row: any) => row.student)
        .filter(Boolean)
        .map((student: any) => student as Tables<'students'>) || [];
      const staff = staffData
        ?.map((row: any) => row.staff)
        .filter(Boolean)
        .map((staffMember: any) => staffMember as Tables<'staff'>) || [];
      
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
        type: type as any,
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


  /**
   * Get sessions for a specific student
   */
  getSessionsForStudent: async (studentId: string, includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    try {
      // Get attendance records for the student
      const { data: attendanceRecords, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_students').select('sessions(*)').eq('student_id', studentId);
      if (error) throw error;
      let sessions = (attendanceRecords ?? []).map((row: { sessions: Tables<'sessions'> | null }) => row.sessions).filter(Boolean) as Tables<'sessions'>[];
      // Filter by status if needed
      if (!includeInactive) {
        sessions = sessions.filter(s => s.status === 'ACTIVE');
      }
      return sessions;
    } catch (error) {
      console.error('Error getting sessions for student:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific staff member
   */
  getSessionsForStaff: async (staffId: string, includeInactive: boolean = false): Promise<Tables<'sessions'>[]> => {
    try {
      // Get assignment records for the staff member
      const { data: assignmentRecords, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('sessions_staff').select('sessions(*)').eq('staff_id', staffId);
      if (error) throw error;
      let sessions = (assignmentRecords ?? []).map((row: { sessions: Tables<'sessions'> | null }) => row.sessions).filter(Boolean) as Tables<'sessions'>[];
      // Filter by status if needed
      if (!includeInactive) {
        sessions = sessions.filter(s => s.status === 'ACTIVE');
      }
      return sessions;
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

    const plannedStudents = (ssRows ?? [])
      .filter((r: any) => !r.planned_absence && r.student)
      .map((r: any) => r.student as Tables<'students'>);

    // sessions_staff with joined staff (only those without planned_absence)
    const { data: sfRows, error: sfErr } = await supabase
      .from('sessions_staff')
      .select('planned_absence, staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name, email, phone_number, status, role)')
      .eq('session_id', sessionId);
    if (sfErr) throw sfErr;
    
    const plannedStaff = (sfRows ?? [])
      .filter((r: any) => !r.planned_absence && r.staff)
      .map((r: any) => r.staff as Tables<'staff'>);

    return { plannedStudents, plannedStaff };
  },

  /**
   * Get comprehensive session details including tutor logs
   */
  getSessionWithTutorLog: async (sessionId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // 1. Get session with class and subject
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
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
      const rescheduledIds = (sessionsStudentsData || [])
        .filter((ss: any) => ss.rescheduled_sessions_students_id)
        .map((ss: any) => ss.rescheduled_sessions_students_id);
      
      const rescheduledSessionsMap: Record<string, any> = {};
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
        
        (rescheduledData || []).forEach((rd: any) => {
          rescheduledSessionsMap[rd.id] = rd;
        });
      }
      
      // Fetch invoice status for sessions_students
      const sessionsStudentsIds = (sessionsStudentsData || []).map((ss: any) => ss.id).filter(Boolean);
      const { data: invoiceItemsData, error: invoiceItemsError } = sessionsStudentsIds.length > 0
        ? await supabase
            .from('invoice_items')
            .select('sessions_students_id, invoice:invoices(status)')
            .in('sessions_students_id', sessionsStudentsIds)
        : { data: [], error: null };
      
      if (invoiceItemsError) throw invoiceItemsError;

      // Build invoice status map: sessions_students_id -> invoice.status
      const invoiceStatusMap: Record<string, string | null> = {};
      invoiceItemsData?.forEach((row: any) => {
        if (row.sessions_students_id && row.invoice) {
          invoiceStatusMap[row.sessions_students_id] = row.invoice.status || null;
        }
      });

      // Attach rescheduled session data and invoice status to sessions_students
      const enrichedSessionsStudentsData = (sessionsStudentsData || []).map((ss: any) => ({
        ...ss,
        rescheduled_session: ss.rescheduled_sessions_students_id
          ? rescheduledSessionsMap[ss.rescheduled_sessions_students_id]
          : null,
        invoice_status: invoiceStatusMap[ss.id] || null,
      }));
      
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
      const swappedStaffIds = (sessionsStaffData || [])
        .filter((sf: any) => sf.swapped_sessions_staff_id)
        .map((sf: any) => sf.swapped_sessions_staff_id);
      
      const swappedStaffMap: Record<string, any> = {};
      if (swappedStaffIds.length > 0) {
        const { data: swappedData, error: swapError } = await supabase
          .from('sessions_staff')
          .select(`
            id,
            staff:staff!sessions_staff_staff_id_fkey(*)
          `)
          .in('id', swappedStaffIds);
        
        if (swapError) throw swapError;
        
        (swappedData || []).forEach((sd: any) => {
          swappedStaffMap[sd.id] = sd.staff;
        });
      }
      
      // Attach swapped staff data to sessions_staff
      const enrichedSessionsStaffData = (sessionsStaffData || []).map((sf: any) => ({
        ...sf,
        swapped_staff: sf.swapped_sessions_staff_id
          ? swappedStaffMap[sf.swapped_sessions_staff_id]
          : null,
      }));
      
      // 4. Get tutor log if it exists
      const { data: tutorLogData, error: tlError } = await supabase
        .from('tutor_logs')
        .select('*')
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
        
        // Get tutor log topics with related data
        const { data: topicsData, error: topicsError } = await supabase
          .from('tutor_logs_topics')
          .select('*, topic:topics(*)')
          .eq('tutor_log_id', tutorLogData.id);
        
        if (topicsError) throw topicsError;
        
        // Get topic-student links
        const topicIds = (topicsData || []).map((t: any) => t.id);
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
        const fileIds = (filesData || []).map((f: any) => f.id);
        const { data: fileStudentsData, error: fsError } = fileIds.length > 0 ? await supabase
          .from('tutor_logs_topics_files_students')
          .select('*, student:students(*)')
          .in('tutor_logs_topics_files_id', fileIds)
          : { data: [], error: null };
        
        if (fsError) throw fsError;
        
        // Build tutor log structure
        tutorLog = {
          ...tutorLogData,
          studentAttendance: studentAttendanceData || [],
          staffAttendance: staffAttendanceData || [],
          topics: (topicsData || []).map((topic: any) => ({
            ...topic,
            students: (topicStudentsData || [])
              .filter((ts: any) => ts.tutor_logs_topics_id === topic.id)
              .map((ts: any) => ts.student),
            files: (filesData || [])
              .filter((f: any) => f.topics_file && f.topics_file.topic_id === topic.topic.id)
              .map((file: any) => ({
                ...file,
                students: (fileStudentsData || [])
                  .filter((fs: any) => fs.tutor_logs_topics_files_id === file.id)
                  .map((fs: any) => fs.student),
              })),
          })),
        };
      }
      
      return {
        session: sessionData,
        sessionsStudents: enrichedSessionsStudentsData || [],
        sessionsStaff: enrichedSessionsStaffData || [],
        tutorLog,
      };
    } catch (error) {
      console.error('Error getting session with tutor log:', error);
      throw error;
    }
  },

  // Note: Session resource files linking has been removed in the resources overhaul
  // If you need to link resources to sessions in the future, consider a new approach
  // using the topics_files table
}; 