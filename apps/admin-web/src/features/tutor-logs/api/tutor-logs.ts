import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorLogFormData, TutorLogWithDetails } from '../types';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tutor Logs API client
 */
export const tutorLogsApi = {
  /**
   * Create a tutor log with all related records atomically via RPC function
   * All operations are executed within a single transaction
   */
  createTutorLog: async (data: TutorLogFormData, createdBy: string): Promise<Tables<'tutor_logs'>> => {
    try {
      const payload = {
        data,
        createdBy,
      };
      
      const response = await fetch('/api/tutor-logs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tutor log');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create tutor log');
      }

      // Fetch the created tutor log to return it
      const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
      const tutorLogId = (result.data as any)?.tutor_log_id;
      
      if (!tutorLogId) {
        throw new Error('Tutor log ID not returned from RPC function');
      }

      const { data: tutorLog, error: fetchError } = await supabase
        .from('tutor_logs')
        .select('*')
        .eq('id', tutorLogId)
        .single();

      if (fetchError) throw fetchError;
      if (!tutorLog) throw new Error('Tutor log not found after creation');

      return tutorLog as Tables<'tutor_logs'>;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get a single tutor log with all related data
   */
  getTutorLog: async (id: string): Promise<TutorLogWithDetails | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;

    try {
      const { data: tutorLog, error: tutorLogError } = await supabase
        .from('tutor_logs')
        .select(`
          *,
          session:sessions(
            *,
            class:classes(
              *,
              subject:subjects(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (tutorLogError) {
        if (tutorLogError.code === 'PGRST116') return null;
        throw tutorLogError;
      }

      // Get staff attendance
      const { data: staffAttendance } = await supabase
        .from('tutor_logs_staff_attendance')
        .select('*, staff:staff(*)')
        .eq('tutor_log_id', id);

      // Get student attendance
      const { data: studentAttendance } = await supabase
        .from('tutor_logs_student_attendance')
        .select('*, student:students(*)')
        .eq('tutor_log_id', id);

      // Get topics with students
      const { data: topics } = await supabase
        .from('tutor_logs_topics')
        .select(`
          *,
          topic:topics(*),
          students:tutor_logs_topics_students(
            *,
            student:students(*)
          )
        `)
        .eq('tutor_log_id', id);

      // Get topic files with students
      const { data: topicFiles } = await supabase
        .from('tutor_logs_topics_files')
        .select(`
          *,
          topicFile:topics_files(*),
          students:tutor_logs_topics_files_students(
            *,
            student:students(*)
          )
        `)
        .eq('tutor_log_id', id);

      // Get notes
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('target_type', 'tutor_logs')
        .eq('target_id', id);

      return {
        ...tutorLog,
        staffAttendance: staffAttendance || [],
        studentAttendance: studentAttendance || [],
        topics: topics || [],
        topicFiles: topicFiles || [],
        notes: notes || [],
      } as TutorLogWithDetails;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check if a session has been logged
   */
  getTutorLogForSession: async (sessionId: string): Promise<Tables<'tutor_logs'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('tutor_logs')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Tables<'tutor_logs'> | null;
  },

  /**
   * Get sessions that haven't been logged yet for a staff member
   * Only returns past/current sessions (start_at <= NOW())
   */
  getUnloggedSessions: async (staffId: string): Promise<Array<Tables<'sessions'> & { 
    class: Tables<'classes'> & { subject: Tables<'subjects'> } 
  }>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;

    try {
      // Get all sessions where this staff is assigned
      const { data: sessionStaffRecords, error: sessionStaffError } = await supabase
        .from('sessions_staff')
        .select('session_id')
        .eq('staff_id', staffId);

      if (sessionStaffError) throw sessionStaffError;

      const sessionIds = (sessionStaffRecords || []).map((r) => r.session_id);

      if (sessionIds.length === 0) return [];

      // Get sessions that are past/current (not logged yet)
      // Filter by date (not timestamp) - allow sessions from today or earlier
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          class:classes!inner(
            *,
            subject:subjects(*)
          )
        `)
        .in('id', sessionIds)
        .eq('type', 'CLASS')
        .lte('start_at', today.toISOString())
        .order('start_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Filter out sessions that already have logs
      const { data: existingLogs, error: logsError } = await supabase
        .from('tutor_logs')
        .select('session_id')
        .in('session_id', sessionIds);

      if (logsError) throw logsError;

      const loggedSessionIds = new Set((existingLogs || []).map((log) => log.session_id));

      return (sessions || []).filter((s: any) => !loggedSessionIds.has(s.id)) as any[];
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all tutor logs (admin only)
   */
  getAllTutorLogs: async (params?: { limit?: number; offset?: number; dateFrom?: string; dateTo?: string }): Promise<{ logs: Tables<'tutor_logs'>[]; total: number }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { limit = 1000, offset = 0, dateFrom, dateTo } = params || {};
    
    let query = supabase
      .from('tutor_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Add date range filters if provided
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply pagination
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      logs: (data ?? []) as Tables<'tutor_logs'>[],
      total: count ?? 0,
    };
  },

  /**
   * Search tutor logs with filters and relationships (admin only)
   * Filters by session date (Adelaide timezone), not tutor log created date
   */
  searchTutorLogs: async (args?: {
    search?: string;
    rangeStart?: string; // YYYY-MM-DD format (Adelaide timezone)
    rangeEnd?: string; // YYYY-MM-DD format (Adelaide timezone)
    staffId?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'session_start_at' | 'created_at';
    ascending?: boolean;
  }): Promise<{
    tutorLogs: Array<{
      id: string;
      session_id: string;
      created_by: string;
      created_at: string;
      updated_at: string | null;
    }>;
    sessions: Record<string, Tables<'sessions'>>;
    sessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>>;
    sessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean }>>;
    classesById: Record<string, Tables<'classes'>>;
    subjectsById: Record<string, Tables<'subjects'>>;
    staffAttendance: Record<string, Array<{
      staff_id: string;
      first_name: string;
      last_name: string;
      role: string;
      attended: boolean;
      type: string | null;
    }>>;
    studentAttendance: Record<string, Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      attended: boolean;
    }>>;
    topics: Record<string, Array<{
      topic_id: string;
      code: string;
      name: string;
    }>>;
    topicFiles: Record<string, Array<{
      file_id: string;
      code: string;
      file_type: string;
    }>>;
    total: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_tutor_logs_admin', {
        p_search: args?.search?.trim() || undefined,
        p_range_start: args?.rangeStart || undefined,
        p_range_end: args?.rangeEnd || undefined,
        p_staff_id: args?.staffId || undefined,
        p_limit: args?.limit || 50,
        p_offset: args?.offset || 0,
        p_order_by: args?.orderBy || 'session_start_at',
        p_ascending: args?.ascending !== undefined ? args.ascending : false,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) {
        return {
          tutorLogs: [],
          sessions: {},
          sessionStudents: {},
          sessionStaff: {},
          classesById: {},
          subjectsById: {},
          staffAttendance: {},
          studentAttendance: {},
          topics: {},
          topicFiles: {},
          total: 0,
        };
      }

      const rpcData = rpcResult as {
        tutorLogs: any[];
        sessions: Record<string, any>;
        sessionStudents: Record<string, any[]>;
        sessionStaff: Record<string, any[]>;
        classesById: Record<string, any>;
        subjectsById: Record<string, any>;
        staffAttendance: Record<string, any[]>;
        studentAttendance: Record<string, any[]>;
        topics: Record<string, any[]>;
        topicFiles: Record<string, any[]>;
        total: number;
      };

      return {
        tutorLogs: (rpcData.tutorLogs || []) as any[],
        sessions: (rpcData.sessions || {}) as Record<string, Tables<'sessions'>>,
        sessionStudents: (rpcData.sessionStudents || {}) as Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>>,
        sessionStaff: (rpcData.sessionStaff || {}) as Record<string, Array<Tables<'staff'> & { planned_absence?: boolean }>>,
        classesById: (rpcData.classesById || {}) as Record<string, Tables<'classes'>>,
        subjectsById: (rpcData.subjectsById || {}) as Record<string, Tables<'subjects'>>,
        staffAttendance: (rpcData.staffAttendance || {}) as Record<string, Array<{
          staff_id: string;
          first_name: string;
          last_name: string;
          role: string;
          attended: boolean;
          type: string | null;
        }>>,
        studentAttendance: (rpcData.studentAttendance || {}) as Record<string, Array<{
          student_id: string;
          first_name: string;
          last_name: string;
          attended: boolean;
        }>>,
        topics: (rpcData.topics || {}) as Record<string, Array<{
          topic_id: string;
          code: string;
          name: string;
        }>>,
        topicFiles: (rpcData.topicFiles || {}) as Record<string, Array<{
          file_id: string;
          code: string;
          file_type: string;
        }>>,
        total: rpcData.total || 0,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update a tutor log (admin only)
   */
  updateTutorLog: async (id: string, data: TutorLogFormData, createdBy: string): Promise<void> => {
    try {
      const response = await fetch(`/api/tutor-logs/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, createdBy }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tutor log');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update tutor log');
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a tutor log (admin only)
   * This will cascade delete all related records
   */
  deleteTutorLog: async (id: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('tutor_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

