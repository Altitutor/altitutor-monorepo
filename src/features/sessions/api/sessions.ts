import { 
  sessionRepository, 
  sessionsStudentsRepository, 
  sessionsStaffRepository,
  sessionsResourceFilesRepository 
} from '@/shared/lib/supabase/db/repositories';
import { Session, SessionAttendance, SessionsStaff, SessionType } from '../types';
import { adminRepository } from '@/shared/lib/supabase/db/admin';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { transformToCamelCase } from '@/shared/lib/supabase/db/utils';
import type { Student, Staff } from '@/shared/lib/supabase/db/types';

/**
 * Sessions API client for working with session data
 */
export const sessionsApi = {
  /**
   * Get all sessions
   */
  getAllSessions: async (): Promise<Session[]> => {
    return sessionRepository.getAll();
  },

  /**
   * Get all sessions with their attendees and staff in an optimized single query
   * This solves the N+1 query problem for the sessions table
   */
  getAllSessionsWithDetails: async (): Promise<{ 
    sessions: Session[]; 
    sessionStudents: Record<string, Student[]>;
    sessionStaff: Record<string, Staff[]>;
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
      const sessions = allSessions?.map(session => transformToCamelCase(session) as Session) || [];
      
      // Build session students map
      const sessionStudentsMap: Record<string, Student[]> = {};
      sessionStudentsData?.forEach((row: any) => {
        if (row.session_id && row.student) {
          if (!sessionStudentsMap[row.session_id]) {
            sessionStudentsMap[row.session_id] = [];
          }
          sessionStudentsMap[row.session_id].push(transformToCamelCase(row.student) as Student);
        }
      });
      
      // Build session staff map
      const sessionStaffMap: Record<string, Staff[]> = {};
      sessionStaffData?.forEach((row: any) => {
        if (row.session_id && row.staff) {
          if (!sessionStaffMap[row.session_id]) {
            sessionStaffMap[row.session_id] = [];
          }
          sessionStaffMap[row.session_id].push(transformToCamelCase(row.staff) as Staff);
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
    session: Session | null;
    students: Student[];
    staff: Staff[];
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
      const session = transformToCamelCase(sessionData) as Session;
      const students = studentsData
        ?.map((row: any) => row.student)
        .filter(Boolean)
        .map((student: any) => transformToCamelCase(student) as Student) || [];
      const staff = staffData
        ?.map((row: any) => row.staff)
        .filter(Boolean)
        .map((staffMember: any) => transformToCamelCase(staffMember) as Staff) || [];
      
      return { session, students, staff };
      
    } catch (error) {
      console.error('Error getting session with details:', error);
      throw error;
    }
  },

  /**
   * Get a session by ID
   */
  getSession: async (id: string): Promise<Session | undefined> => {
    return sessionRepository.getById(id);
  },

  /**
   * Create a new session
   */
  createSession: async (data: Partial<Session>): Promise<Session> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    return sessionRepository.create(data);
  },

  /**
   * Update a session
   */
  updateSession: async (id: string, data: Partial<Session>): Promise<Session> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    return sessionRepository.update(id, data);
  },

  /**
   * Delete a session
   */
  deleteSession: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    await sessionRepository.delete(id);
  },

  /**
   * Add a student to a session (mark attendance)
   */
  addStudentToSession: async (sessionId: string, studentId: string, attended: boolean = false): Promise<SessionAttendance> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      const attendanceData: Partial<SessionAttendance> = {
        sessionId,
        studentId,
        attended,
      };
      
      return sessionsStudentsRepository.create(attendanceData);
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
      await adminRepository.ensureAdminUser();
      
      // Find the attendance record
      const attendanceRecords = await sessionsStudentsRepository.getBy('session_id', sessionId);
      const recordToDelete = attendanceRecords.find(record => record.studentId === studentId);
      
      if (recordToDelete) {
        await sessionsStudentsRepository.delete(recordToDelete.id);
      }
    } catch (error) {
      console.error('Error removing student from session:', error);
      throw error;
    }
  },

  /**
   * Assign a staff member to a session
   */
  assignStaffToSession: async (sessionId: string, staffId: string, type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' = 'MAIN_TUTOR'): Promise<SessionsStaff> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      const assignmentData: Partial<SessionsStaff> = {
        sessionId,
        staffId,
        type,
      };
      
      return sessionsStaffRepository.create(assignmentData);
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
      await adminRepository.ensureAdminUser();
      
      // Find the assignment record
      const assignmentRecords = await sessionsStaffRepository.getBy('session_id', sessionId);
      const recordToDelete = assignmentRecords.find(record => record.staffId === staffId);
      
      if (recordToDelete) {
        await sessionsStaffRepository.delete(recordToDelete.id);
      }
    } catch (error) {
      console.error('Error removing staff from session:', error);
      throw error;
    }
  },

  /**
   * Update student attendance for a session
   */
  updateAttendance: async (sessionId: string, studentId: string, attended: boolean, notes?: string): Promise<SessionAttendance> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Find the attendance record
      const attendanceRecords = await sessionsStudentsRepository.getBy('session_id', sessionId);
      const attendanceRecord = attendanceRecords.find(record => record.studentId === studentId);
      
      if (attendanceRecord) {
        return sessionsStudentsRepository.update(attendanceRecord.id, {
          attended,
          notes,
        });
      } else {
        throw new Error('Attendance record not found');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific student
   */
  getSessionsForStudent: async (studentId: string): Promise<Session[]> => {
    try {
      // Get attendance records for the student
      const attendanceRecords = await sessionsStudentsRepository.getBy('student_id', studentId);
      
      // Get the sessions for these attendance records
      const sessionPromises = attendanceRecords.map(async (attendance) => {
        return sessionRepository.getById(attendance.sessionId);
      });
      
      const sessions = await Promise.all(sessionPromises);
      return sessions.filter(session => session !== undefined) as Session[];
    } catch (error) {
      console.error('Error getting sessions for student:', error);
      throw error;
    }
  },

  /**
   * Get sessions for a specific staff member
   */
  getSessionsForStaff: async (staffId: string): Promise<Session[]> => {
    try {
      // Get assignment records for the staff member
      const assignmentRecords = await sessionsStaffRepository.getBy('staff_id', staffId);
      
      // Get the sessions for these assignment records
      const sessionPromises = assignmentRecords.map(async (assignment) => {
        return sessionRepository.getById(assignment.sessionId);
      });
      
      const sessions = await Promise.all(sessionPromises);
      return sessions.filter(session => session !== undefined) as Session[];
    } catch (error) {
      console.error('Error getting sessions for staff:', error);
      throw error;
    }
  },
}; 