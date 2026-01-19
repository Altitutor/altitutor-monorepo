import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { sessionsKeys } from '../../sessions/hooks/useSessionsQuery';

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

        const session = sessionData as any;
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
          ? staffData.map((row: any) => ({
              ...row.staff,
              planned_absence: row.planned_absence,
            }))
          : [];

        // Get session students with planned_absence, is_extra, and sessions_students_id
        const { data: studentsData, error: studentsError } = await supabase
          .from('sessions_students')
          .select(`
            id,
            planned_absence,
            is_extra,
            student:students(*)
          `)
          .eq('session_id', sessionId);

        const students = !studentsError && studentsData
          ? studentsData.map((row: any) => ({
              ...row.student,
              planned_absence: row.planned_absence,
              is_extra: row.is_extra,
              sessions_students_id: row.id,
            }))
          : [];

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
