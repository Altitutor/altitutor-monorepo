import type {
  StaffAbsenceOperation,
  LogStaffAbsencesResponse,
  GetReplacementStaffParams,
  StaffSession,
  ReplacementStaff,
} from '../types/staff-absence';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

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
   * Get a staff member's future sessions with session-staff enrollment details
   * 
   * Note: We use direct queries from sessions_staff rather than search_sessions_admin RPC
   * because we need the sessionsStaffId from sessions_staff table for absence logging.
   * The RPC returns sessions but doesn't provide the sessions_staff.id we need.
   */
  getStaffFutureSessions: async (staffId: string, weeksAhead: number = 8): Promise<StaffSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

    try {
      // Get sessions_staff records for this staff with session details
      const { data, error } = await supabase
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
        .eq('planned_absence', false)
        .gte('session.start_at', now.toISOString());

      if (error) throw error;

      // Transform, filter by date range, and sort the data client-side
      const sessions: StaffSession[] = (data || [])
        .filter((row: any) => row.session) // Filter out any null sessions
        .map((row: any) => {
          const session = row.session as Tables<'sessions'>;
          return {
            ...session,
            class: row.session.class || null,
            subject: row.session.class?.subject || null,
            sessionsStaffId: row.id,
          } as StaffSession;
        })
        .filter((session) => {
          // Filter by date range on the client side
          const sessionDate = new Date(session.start_at || 0);
          return sessionDate <= maxDate;
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
   * Get available replacement staff who teach the same subject
   * Queries from both classes_staff → classes → subject_id AND staff_subjects → subject_id
   */
  getAvailableReplacementStaff: async (
    params: GetReplacementStaffParams
  ): Promise<ReplacementStaff[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { sessionId, subjectId, excludeStaffIds } = params;

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

      // Combine excludeStaffIds with assigned staff IDs
      const allExcludedIds = new Set([
        ...excludeStaffIds,
        ...Array.from(assignedStaffIds),
      ]);

      // Query staff from classes_staff → classes → subject_id
      // Use explicit foreign key relationship to avoid ambiguity
      // Note: classes_staff doesn't have a status column - use unassigned_at IS NULL for active
      const { data: staffFromClasses, error: classesError } = await supabase
        .from('classes_staff')
        .select(`
          staff_id,
          class_id,
          class:classes!inner(
            id,
            subject_id
          ),
          staff:staff!class_assignments_staff_id_fkey(
            id,
            first_name,
            last_name,
            email,
            phone_number,
            role,
            status
          )
        `)
        .is('unassigned_at', null)
        .eq('class.subject_id', subjectId)
        .eq('staff.status', 'ACTIVE');

      if (classesError) throw classesError;

      const staffIdsFromClasses = new Set(
        (staffFromClasses || []).map((cs: any) => cs.staff.id)
      );

      // Query staff from staff_subjects → subject_id
      const { data: staffFromSubjects, error: subjectsError } = await supabase
        .from('staff_subjects')
        .select(`
          staff_id,
          staff:staff!inner(
            id,
            first_name,
            last_name,
            email,
            phone_number,
            role,
            status
          )
        `)
        .eq('subject_id', subjectId)
        .in('staff.status', ['ACTIVE']);

      if (subjectsError) throw subjectsError;

      const staffIdsFromSubjects = new Set(
        (staffFromSubjects || []).map((ss: any) => ss.staff.id)
      );

      // Combine both sets of staff IDs
      const allStaffIds = new Set([
        ...Array.from(staffIdsFromClasses),
        ...Array.from(staffIdsFromSubjects),
      ]);

      // Filter out excluded staff
      const availableStaffIds = Array.from(allStaffIds).filter(
        (id) => !allExcludedIds.has(id)
      );

      if (availableStaffIds.length === 0) {
        return [];
      }

      // Get full staff details
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .in('id', availableStaffIds)
        .eq('status', 'ACTIVE')
        .order('last_name', { ascending: true });

      if (staffError) throw staffError;

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
      const subjectsMap = new Map<string, Tables<'subjects'>[]>();
      (staffSubjectsData || []).forEach((row: any) => {
        if (!subjectsMap.has(row.staff_id)) {
          subjectsMap.set(row.staff_id, []);
        }
        if (row.subject) {
          subjectsMap.get(row.staff_id)!.push(row.subject);
        }
      });

      // Combine staff with subjects
      const replacementStaff: ReplacementStaff[] = (staffData || []).map((staff) => ({
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

