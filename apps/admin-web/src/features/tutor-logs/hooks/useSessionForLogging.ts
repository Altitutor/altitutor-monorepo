import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { sessionsKeys } from '../../sessions/hooks/useSessionsQuery';

// Types for Supabase query results with joins
type SessionWithClassAndSubject = Tables<'sessions'> & {
  class: (Tables<'classes'> & {
    subject: Tables<'subjects'> | null;
  }) | null;
};

type SessionsStaffRow = {
  planned_absence: boolean;
  staff: Tables<'staff'>;
};

type SessionsStudentsRow = {
  id: string;
  planned_absence: boolean;
  student: Tables<'students'>;
};

type ClassesStudentsRow = {
  student_id: string;
  unenrolled_at: string | null;
};

export interface SessionForLogging {
  session: Tables<'sessions'> | null;
  classData: Tables<'classes'> | null;
  subject: Tables<'subjects'> | null;
  staff: Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>;
  students: Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean; sessions_students_id?: string | null }>;
}

/**
 * Hook to fetch session data needed for logging tutor sessions
 * Includes session, class, subject, staff, and students with their attendance metadata
 */
export function useSessionForLogging(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: [...sessionsKeys.detail(sessionId || ''), 'forLogging'],
    queryFn: async (): Promise<SessionForLogging> => {
      if (!sessionId) {
        return {
          session: null,
          classData: null,
          subject: null,
          staff: [],
          students: [],
        };
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      try {
        // Get session with class and subject
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

        if (sessionError) {
          if (sessionError.code === 'PGRST116') {
            return {
              session: null,
              classData: null,
              subject: null,
              staff: [],
              students: [],
            };
          }
          throw sessionError;
        }

        const session = sessionData as SessionWithClassAndSubject;
        const classData = session.class || null;
        const subject = session.class?.subject || null;

        // Get session staff with planned_absence
        const { data: staffData, error: staffError } = await supabase
          .from('sessions_staff')
          .select(`
            planned_absence,
            staff:staff!sessions_staff_staff_id_fkey(*)
          `)
          .eq('session_id', sessionId);

        const staff = !staffError && staffData
          ? (staffData as SessionsStaffRow[]).map((row) => ({
              ...row.staff,
              planned_absence: row.planned_absence,
            }))
          : [];

        // Get session students with planned_absence and sessions_students_id
        // Note: is_extra is calculated based on class enrollment, not stored in sessions_students table
        const { data: studentsData, error: studentsError } = await supabase
          .from('sessions_students')
          .select(`
            id,
            planned_absence,
            student:students(*)
          `)
          .eq('session_id', sessionId);

        // Calculate is_extra for each student: student is extra if session has class_id but student is not enrolled
        let students: Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean; sessions_students_id?: string | null }> = [];
        
        if (!studentsError && studentsData && studentsData.length > 0) {
          const classId = session.class_id;
          
          // If session has a class_id, check which students are enrolled
          const enrolledStudentIds = new Set<string>();
          if (classId) {
            const typedStudentsData = studentsData as SessionsStudentsRow[];
            const studentIds = typedStudentsData.map((row) => row.student?.id).filter((id): id is string => Boolean(id));
            if (studentIds.length > 0) {
              const { data: enrollmentsData } = await supabase
                .from('classes_students')
                .select('student_id, unenrolled_at')
                .eq('class_id', classId)
                .in('student_id', studentIds);
              
              if (enrollmentsData) {
                const sessionStartAt = session.start_at ? new Date(session.start_at) : null;
                (enrollmentsData as ClassesStudentsRow[]).forEach((enrollment) => {
                  // Student is enrolled if not unenrolled, or unenrolled after session start
                  if (!enrollment.unenrolled_at || (sessionStartAt && new Date(enrollment.unenrolled_at) > sessionStartAt)) {
                    enrolledStudentIds.add(enrollment.student_id);
                  }
                });
              }
            }
          }
          
          const typedStudentsData = studentsData as SessionsStudentsRow[];
          students = typedStudentsData.map((row) => {
            const studentId = row.student?.id;
            const isExtra = classId ? !enrolledStudentIds.has(studentId) : false;
            
            return {
              ...row.student,
              planned_absence: row.planned_absence,
              is_extra: isExtra,
              sessions_students_id: row.id,
            };
          });
        }

        return {
          session: session as Tables<'sessions'>,
          classData: classData as Tables<'classes'> | null,
          subject: subject as Tables<'subjects'> | null,
          staff,
          students,
        };
      } catch (error) {
        console.error('Error fetching session for logging:', error);
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
