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
  type: string;
  staff: Tables<'staff'>;
};

type SessionsStudentsRow = {
  id: string;
  planned_absence: boolean;
  was_trial: boolean;
  is_rescheduled: boolean;
  is_credited: boolean;
  rescheduled_sessions_students_id: string | null;
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
  staff: Array<
    Tables<'staff'> & {
      planned_absence?: boolean;
      is_swapped_in?: boolean;
      session_staff_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
      sessions_staff_id?: string | null;
      session_was_trial?: boolean;
      is_swapped?: boolean;
      swapped_sessions_staff_id?: string | null;
      swapped_staff?: { id: string; first_name: string; last_name: string } | null;
    }
  >;
  students: Array<
    Tables<'students'> & {
      planned_absence?: boolean;
      is_extra?: boolean;
      sessions_students_id?: string | null;
      session_was_trial?: boolean;
      session_is_rescheduled?: boolean;
      session_is_credited?: boolean;
      rescheduled_sessions_students_id?: string | null;
    }
  >;
  parents: Array<Tables<'parents'> & { sessions_parents_id?: string }>;
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
          parents: [],
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
              parents: [],
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
            id,
            planned_absence,
            type,
            was_trial,
            is_swapped,
            swapped_sessions_staff_id,
            staff:staff!sessions_staff_staff_id_fkey(*)
          `)
          .eq('session_id', sessionId);

        type StaffRow = SessionsStaffRow & {
          id: string;
          was_trial?: boolean;
          is_swapped?: boolean;
          swapped_sessions_staff_id?: string | null;
        };

        let staff: SessionForLogging['staff'] = [];
        if (!staffError && staffData && staffData.length > 0) {
          const typedStaffData = staffData as StaffRow[];
          const swappedIds = typedStaffData
            .map((r) => r.swapped_sessions_staff_id)
            .filter((id): id is string => Boolean(id));
          const swappedStaffMap: Record<string, Tables<'staff'>> = {};
          if (swappedIds.length > 0) {
            const { data: swappedRows } = await supabase
              .from('sessions_staff')
              .select(
                `
                id,
                staff:staff!sessions_staff_staff_id_fkey(id, first_name, last_name)
              `
              )
              .in('id', swappedIds);
            (swappedRows as Array<{ id: string; staff: Tables<'staff'> | null }> | null)?.forEach((row) => {
              if (row.staff) swappedStaffMap[row.id] = row.staff;
            });
          }
          staff = typedStaffData.map((row) => ({
            ...row.staff,
            planned_absence: row.planned_absence,
            session_staff_type: row.type as
              | 'MAIN_TUTOR'
              | 'SECONDARY_TUTOR'
              | 'TRIAL_TUTOR'
              | undefined,
            sessions_staff_id: row.id,
            session_was_trial: row.was_trial ?? false,
            is_swapped: row.is_swapped ?? false,
            swapped_sessions_staff_id: row.swapped_sessions_staff_id,
            swapped_staff: row.swapped_sessions_staff_id
              ? (() => {
                  const s = swappedStaffMap[row.swapped_sessions_staff_id!];
                  return s
                    ? {
                        id: s.id,
                        first_name: s.first_name ?? '',
                        last_name: s.last_name ?? '',
                      }
                    : null;
                })()
              : null,
          }));
        }

        // Get session students with planned_absence and sessions_students_id
        // Note: is_extra is calculated based on class enrollment, not stored in sessions_students table
        const { data: studentsData, error: studentsError } = await supabase
          .from('sessions_students')
          .select(`
            id,
            planned_absence,
            was_trial,
            is_rescheduled,
            is_credited,
            rescheduled_sessions_students_id,
            student:students(*)
          `)
          .eq('session_id', sessionId);

        let students: SessionForLogging['students'] = [];

        if (!studentsError && studentsData && studentsData.length > 0) {
          const classId = session.class_id;

          const enrolledStudentIds = new Set<string>();
          if (classId) {
            const typedStudentsData = studentsData as SessionsStudentsRow[];
            const studentIds = typedStudentsData.map((row) => row.student?.id).filter((id): id is string => Boolean(id));
            if (studentIds.length > 0) {
              const { data: enrollmentsData, error: enrollError } = await supabase
                .from('classes_students')
                .select('student_id, unenrolled_at')
                .eq('class_id', classId)
                .in('student_id', studentIds);

              if (enrollError) {
                console.error('Error loading class enrollments for tutor log:', enrollError);
                studentIds.forEach((id) => enrolledStudentIds.add(id));
              } else if (enrollmentsData) {
                const sessionStartAt = session.start_at ? new Date(session.start_at) : null;
                (enrollmentsData as ClassesStudentsRow[]).forEach((enrollment) => {
                  if (
                    !enrollment.unenrolled_at ||
                    (sessionStartAt && new Date(enrollment.unenrolled_at) > sessionStartAt)
                  ) {
                    enrolledStudentIds.add(enrollment.student_id);
                  }
                });
              }
            }
          }

          const typedStudentsData = studentsData as SessionsStudentsRow[];
          students = typedStudentsData.map((row) => {
            const studentId = row.student?.id;
            const isExtra =
              classId && studentId ? !enrolledStudentIds.has(studentId) : false;

            return {
              ...row.student,
              planned_absence: row.planned_absence,
              is_extra: isExtra,
              sessions_students_id: row.id,
              session_was_trial: row.was_trial ?? false,
              session_is_rescheduled: row.is_rescheduled ?? false,
              session_is_credited: row.is_credited ?? false,
              rescheduled_sessions_students_id: row.rescheduled_sessions_students_id,
            };
          });
        }

        const { data: parentsData, error: parentsError } = await supabase
          .from('sessions_parents')
          .select('id, parent:parents(*)')
          .eq('session_id', sessionId);

        const parents =
          !parentsError && parentsData
            ? (parentsData as Array<{ id: string; parent: Tables<'parents'> | null }>)
                .filter((r): r is { id: string; parent: Tables<'parents'> } => r.parent != null)
                .map((r) => ({
                  ...r.parent!,
                  sessions_parents_id: r.id,
                }))
            : [];

        return {
          session: session as Tables<'sessions'>,
          classData: classData as Tables<'classes'> | null,
          subject: subject as Tables<'subjects'> | null,
          staff,
          students,
          parents,
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
