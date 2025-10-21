import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/**
 * Sessions API client for working with session data
 */
export const sessionsApi = {
  /**
   * Get all sessions
   */
  getAllSessions: async (): Promise<Tables<'sessions'>[]> => {
    const { data, error } = await getSupabaseClient().from('sessions').select('*');
    if (error) throw error;
    return (data ?? []) as Tables<'sessions'>[];
  },

  /**
   * Get all sessions with their attendees and staff in an optimized single query
   * This solves the N+1 query problem for the sessions table
   */
  getAllSessionsWithDetails: async (): Promise<{ 
    sessions: Tables<'sessions'>[]; 
    sessionStudents: Record<string, Tables<'students'>[]>;
    sessionStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = getSupabaseClient();
    
    try {
      // Get all sessions first
      const { data: allSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*');
      
      if (sessionsError) throw sessionsError;
      
      // Get session students with student details
      const { data: sessionStudentsData, error: studentsError } = await supabase
        .from('sessions_students')
        .select(`
          session_id,
          student:students(*)
        `);
      
      if (studentsError) throw studentsError;
      
      // Get session staff with staff details
      const { data: sessionStaffData, error: staffError } = await supabase
        .from('sessions_staff')
        .select(`
          session_id,
          staff:staff(*)
        `);
      
      if (staffError) throw staffError;
      
      // Transform sessions data
      const sessions = (allSessions ?? []) as Tables<'sessions'>[];
      
      // Build session students map
      const sessionStudentsMap: Record<string, Tables<'students'>[]> = {};
      sessionStudentsData?.forEach((row: any) => {
        if (row.session_id && row.student) {
          if (!sessionStudentsMap[row.session_id]) {
            sessionStudentsMap[row.session_id] = [];
          }
          sessionStudentsMap[row.session_id].push(row.student as Tables<'students'>);
        }
      });
      
      // Build session staff map
      const sessionStaffMap: Record<string, Tables<'staff'>[]> = {};
      sessionStaffData?.forEach((row: any) => {
        if (row.session_id && row.staff) {
          if (!sessionStaffMap[row.session_id]) {
            sessionStaffMap[row.session_id] = [];
          }
          sessionStaffMap[row.session_id].push(row.staff as Tables<'staff'>);
        }
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
        sessionStaff: sessionStaffMap
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
    const supabase = getSupabaseClient();
    
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
        .select(`
          staff:staff(*)
        `)
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
    const { data, error } = await getSupabaseClient().from('sessions').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'sessions'> | null;
  },

  /**
   * Create a new session
   */
  createSession: async (data: TablesInsert<'sessions'>): Promise<Tables<'sessions'>> => {
    // Ensure the user is an admin first
    
    const { data: created, error } = await getSupabaseClient().from('sessions').insert(data).select().single();
    if (error) throw error;
    return created as Tables<'sessions'>;
  },

  /**
   * Update a session
   */
  updateSession: async (id: string, data: TablesUpdate<'sessions'>): Promise<Tables<'sessions'>> => {
    // Ensure the user is an admin first
    
    const { data: updated, error } = await getSupabaseClient().from('sessions').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated as Tables<'sessions'>;
  },

  /**
   * Delete a session
   */
  deleteSession: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    
    const { error } = await getSupabaseClient().from('sessions').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Add a student to a session (mark attendance)
   */
  addStudentToSession: async (sessionId: string, studentId: string, attended: boolean = false): Promise<Tables<'sessions_students'>> => {
    try {
      const payload: TablesInsert<'sessions_students'> = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        student_id: studentId,
        attended,
      };
      const { data, error } = await getSupabaseClient().from('sessions_students').insert(payload).select().single();
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
      const { data, error } = await getSupabaseClient().from('sessions_students').select('id').eq('session_id', sessionId).eq('student_id', studentId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await getSupabaseClient().from('sessions_students').delete().eq('session_id', sessionId).eq('student_id', studentId);
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
      const { data, error } = await getSupabaseClient().from('sessions_staff').insert(payload).select().single();
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
      const { data, error } = await getSupabaseClient().from('sessions_staff').select('id').eq('session_id', sessionId).eq('staff_id', staffId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await getSupabaseClient().from('sessions_staff').delete().eq('session_id', sessionId).eq('staff_id', staffId);
        if (delError) throw delError;
      }
    } catch (error) {
      console.error('Error removing staff from session:', error);
      throw error;
    }
  },

  /**
   * Update student attendance for a session
   */
  updateAttendance: async (sessionId: string, studentId: string, attended: boolean, notes?: string): Promise<Tables<'sessions_students'>> => {
    try {
      const { data, error } = await getSupabaseClient().from('sessions_students').update({ attended, notes: notes ?? null }).eq('session_id', sessionId).eq('student_id', studentId).select().single();
      if (error) throw error;
      return data as Tables<'sessions_students'>;
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific student
   */
  getSessionsForStudent: async (studentId: string): Promise<Tables<'sessions'>[]> => {
    try {
      // Get attendance records for the student
      const { data: attendanceRecords, error } = await getSupabaseClient().from('sessions_students').select('sessions(*)').eq('student_id', studentId);
      if (error) throw error;
      const sessions = (attendanceRecords ?? []).map((row: { sessions: Tables<'sessions'> | null }) => row.sessions).filter(Boolean) as Tables<'sessions'>[];
      return sessions;
    } catch (error) {
      console.error('Error getting sessions for student:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific staff member
   */
  getSessionsForStaff: async (staffId: string): Promise<Tables<'sessions'>[]> => {
    try {
      // Get assignment records for the staff member
      const { data: assignmentRecords, error } = await getSupabaseClient().from('sessions_staff').select('sessions(*)').eq('staff_id', staffId);
      if (error) throw error;
      const sessions = (assignmentRecords ?? []).map((row: { sessions: Tables<'sessions'> | null }) => row.sessions).filter(Boolean) as Tables<'sessions'>[];
      return sessions;
    } catch (error) {
      console.error('Error getting sessions for staff:', error);
      throw error;
    }
  },
}; 