import type {
  StaffAbsenceOperation,
  LogStaffAbsencesResponse,
  UndoStaffAbsenceOperation,
  UndoStaffAbsencesResponse,
  GetReplacementStaffParams,
  StaffSession,
  ReplacementStaff,
} from '../types/staff-absence';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Type definitions for joined query results
type SessionsStaffWithSessionRow = Tables<'sessions_staff'> & {
  session: (Tables<'sessions'> & {
    class: (Tables<'classes'> & {
      subject: Tables<'subjects'> | null;
    }) | null;
  }) | null;
};

type StaffSubjectsWithSubjectRow = {
  staff_id: string;
  subject: Tables<'subjects'> | null;
};

/**
 * Staff Absences API client for logging staff absences
 */
export const staffAbsencesApi = {
  /**
   * Log staff absences (swap or log-only)
   * All operations are executed atomically via RPC function
   */
  logStaffAbsences: async (
    operations: StaffAbsenceOperation[],
    staffId: string
  ): Promise<LogStaffAbsencesResponse> => {
    try {
      const response = await fetch('/api/staff-absences/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations,
          staffId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to log staff absences',
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error logging staff absences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  /**
   * Undo staff absences (swap or log revert)
   * All operations are executed atomically via RPC function
   */
  undoStaffAbsences: async (
    operations: UndoStaffAbsenceOperation[],
    staffId: string
  ): Promise<UndoStaffAbsencesResponse> => {
    try {
      const response = await fetch('/api/staff-absences/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations,
          staffId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to undo staff absences',
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error undoing staff absences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  /**
   * Get a staff member's future sessions with session-staff enrollment details
   * 
   * Note: We use direct queries from sessions_staff rather than search_sessions_admin RPC
   * because we need the sessionsStaffId from sessions_staff table for absence logging.
   * The RPC returns sessions but doesn't provide the sessions_staff.id we need.
   */
  getStaffFutureSessions: async (
    staffId: string, 
    weeksAhead: number = 8,
    allowPastSessions: boolean = false,
    weeksBack: number = 4
  ): Promise<StaffSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
    const minDate = allowPastSessions 
      ? new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000)
      : now;

    try {
      // Build query
      let query = supabase
        .from('sessions_staff')
        .select(`
          id,
          session_id,
          planned_absence,
          session:sessions!inner(
            *,
            class:classes(
              *,
              subject:subjects(*)
            )
          )
        `)
        .eq('staff_id', staffId)
        .eq('planned_absence', false);

      // Only filter by start_at if we're not allowing past sessions
      if (!allowPastSessions) {
        query = query.gte('session.start_at', now.toISOString());
      } else {
        // When allowing past sessions, set a minimum date to avoid loading too many old sessions
        query = query.gte('session.start_at', minDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform, filter by date range, and sort the data client-side
      const typedData = (data || []) as SessionsStaffWithSessionRow[];
      const sessions: StaffSession[] = typedData
        .filter((row): row is SessionsStaffWithSessionRow & { session: NonNullable<SessionsStaffWithSessionRow['session']> } => row.session !== null)
        .map((row) => {
          const session = row.session;
          return {
            ...session,
            class: session.class || null,
            subject: session.class?.subject || null,
            sessionsStaffId: row.id,
          } as StaffSession;
        })
        .filter((session) => {
          // Filter by date range on the client side
          const sessionDate = new Date(session.start_at || 0);
          return sessionDate >= minDate && sessionDate <= maxDate;
        })
        .sort((a, b) => {
          // Sort by start_at ascending
          const dateA = new Date(a.start_at || 0).getTime();
          const dateB = new Date(b.start_at || 0).getTime();
          return dateA - dateB;
        });

      return sessions;
    } catch (error) {
      console.error('Error getting staff future sessions:', error);
      throw error;
    }
  },

  /**
   * Get available replacement staff
   * Filters by: ACTIVE status, not already assigned to same session, not original staff member
   */
  getAvailableReplacementStaff: async (
    params: GetReplacementStaffParams
  ): Promise<ReplacementStaff[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { sessionId, excludeStaffIds } = params;

    try {
      // Get session to find staff already assigned
      const { data: sessionStaff, error: sessionStaffError } = await supabase
        .from('sessions_staff')
        .select('staff_id')
        .eq('session_id', sessionId)
        .eq('planned_absence', false);

      if (sessionStaffError) throw sessionStaffError;

      const assignedStaffIds = new Set(
        (sessionStaff || []).map((sf) => sf.staff_id)
      );

      // Combine excludeStaffIds (original staff) with assigned staff IDs
      const allExcludedIds = new Set([
        ...excludeStaffIds,
        ...Array.from(assignedStaffIds),
      ]);

      // Query all ACTIVE staff
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('last_name', { ascending: true });

      if (staffError) throw staffError;

      // Filter out excluded staff (original staff and already assigned staff)
      const availableStaff = (staffData || []).filter(
        (staff) => !allExcludedIds.has(staff.id)
      );

      if (availableStaff.length === 0) {
        return [];
      }

      const availableStaffIds = availableStaff.map((staff) => staff.id);

      // Get subjects for each staff member
      const { data: staffSubjectsData, error: staffSubjectsError } = await supabase
        .from('staff_subjects')
        .select(`
          staff_id,
          subject:subjects(*)
        `)
        .in('staff_id', availableStaffIds);

      if (staffSubjectsError) throw staffSubjectsError;

      // Build subjects map
      const typedStaffSubjectsData = (staffSubjectsData || []) as StaffSubjectsWithSubjectRow[];
      const subjectsMap = new Map<string, Tables<'subjects'>[]>();
      typedStaffSubjectsData.forEach((row) => {
        if (!subjectsMap.has(row.staff_id)) {
          subjectsMap.set(row.staff_id, []);
        }
        if (row.subject) {
          subjectsMap.get(row.staff_id)!.push(row.subject);
        }
      });

      // Combine staff with subjects
      const replacementStaff: ReplacementStaff[] = availableStaff.map((staff) => ({
        ...staff,
        subjects: subjectsMap.get(staff.id) || [],
      }));

      return replacementStaff;
    } catch (error) {
      console.error('Error getting available replacement staff:', error);
      throw error;
    }
  },
};
