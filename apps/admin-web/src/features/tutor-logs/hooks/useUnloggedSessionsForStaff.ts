import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { sessionsKeys } from '../../sessions/hooks/useSessionsQuery';

export interface UnloggedSessionData {
  sessions: Tables<'sessions'>[];
  sessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>>;
  sessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean }>>;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
}

/**
 * Hook to fetch sessions for a staff member that don't have tutor logs yet
 * Returns sessions with their related data (students, staff, classes, subjects)
 */
export function useUnloggedSessionsForStaff(staffId: string | null | undefined) {
  return useQuery({
    queryKey: [...sessionsKeys.forStaff(staffId || ''), 'unlogged'],
    queryFn: async (): Promise<UnloggedSessionData> => {
      if (!staffId) {
        return {
          sessions: [],
          sessionStudents: {},
          sessionStaff: {},
          classesById: {},
          subjectsById: {},
        };
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      try {
        // Get all sessions for this staff using RPC
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
          p_search: undefined,
          p_range_start: undefined,
          p_range_end: today.toISOString(),
          p_staff_id: staffId,
          p_class_id: undefined,
          p_student_id: undefined,
          p_statuses: ['ACTIVE'],
          p_types: undefined, // Include all session types
          p_include_relationships: true,
          p_limit: 1000,
          p_offset: 0,
          p_order_by: 'start_at',
          p_ascending: false,
        });

        if (rpcError) throw rpcError;
        if (!rpcResult) {
          return {
            sessions: [],
            sessionStudents: {},
            sessionStaff: {},
            classesById: {},
            subjectsById: {},
          };
        }

        const rpcData = rpcResult as {
          sessions: any[];
          sessionStudents: Record<string, any[]>;
          sessionStaff: Record<string, any[]>;
          classesById: Record<string, any>;
          subjectsById: Record<string, any>;
          total: number;
        };

        // Filter out sessions that already have tutor logs
        const { data: existingLogs } = await supabase
          .from('tutor_logs')
          .select('session_id');

        const loggedSessionIds = new Set((existingLogs || []).map((log: any) => log.session_id));
        const unloggedSessions = (rpcData.sessions || []).filter(
          (s: any) => !loggedSessionIds.has(s.id)
        );

        return {
          sessions: unloggedSessions as Tables<'sessions'>[],
          sessionStudents: rpcData.sessionStudents || {},
          sessionStaff: rpcData.sessionStaff || {},
          classesById: rpcData.classesById || {},
          subjectsById: rpcData.subjectsById || {},
        };
      } catch (error) {
        console.error('Error fetching unlogged sessions:', error);
        throw error;
      }
    },
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
