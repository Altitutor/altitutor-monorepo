import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorLogFormData, TutorLogWithDetails } from '../types';

/**
 * Tutor Logs API client
 */
export const tutorLogsApi = {
  /**
   * Create a tutor log with all related records
   * This should be done in a transaction-like manner
   */
  createTutorLog: async (data: TutorLogFormData, createdBy: string): Promise<Tables<'tutor_logs'>> => {
    const supabase = getSupabaseClient();

    try {
      // 1. Create the tutor log
      const tutorLogPayload: TablesInsert<'tutor_logs'> = {
        id: crypto.randomUUID(),
        session_id: data.sessionId,
        created_by: createdBy,
      };

      const { data: tutorLog, error: tutorLogError } = await supabase
        .from('tutor_logs')
        .insert(tutorLogPayload)
        .select()
        .single();

      if (tutorLogError) throw tutorLogError;

      const tutorLogId = tutorLog.id;

      // 2. Create staff attendance records
      if (data.staffAttendance.length > 0) {
        const staffAttendancePayload = data.staffAttendance.map((sa) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          staff_id: sa.staffId,
          attended: sa.attended,
          type: sa.type,
        }));

        const { error: staffError } = await supabase
          .from('tutor_logs_staff_attendance')
          .insert(staffAttendancePayload);

        if (staffError) throw staffError;
      }

      // 3. Create student attendance records
      if (data.studentAttendance.length > 0) {
        const studentAttendancePayload = data.studentAttendance.map((sa) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          student_id: sa.studentId,
          attended: sa.attended,
          created_by: createdBy,
        }));

        const { error: studentError } = await supabase
          .from('tutor_logs_student_attendance')
          .insert(studentAttendancePayload);

        if (studentError) throw studentError;
      }

      // 4. Create topic records
      if (data.topics.length > 0) {
        const topicsPayload = data.topics.map((t) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          topic_id: t.topicId,
          created_by: createdBy,
        }));

        const { data: createdTopics, error: topicsError } = await supabase
          .from('tutor_logs_topics')
          .insert(topicsPayload)
          .select();

        if (topicsError) throw topicsError;

        // 5. Create topic-student links
        const topicStudentsPayload: TablesInsert<'tutor_logs_topics_students'>[] = [];
        data.topics.forEach((t) => {
          const tutorLogTopicRecord = createdTopics?.find(
            (ct: any) => ct.topic_id === t.topicId
          );
          if (tutorLogTopicRecord) {
            t.studentIds.forEach((studentId) => {
              topicStudentsPayload.push({
                id: crypto.randomUUID(),
                tutor_logs_topics_id: tutorLogTopicRecord.id,
                student_id: studentId,
                created_by: createdBy,
              });
            });
          }
        });

        if (topicStudentsPayload.length > 0) {
          const { error: topicStudentsError } = await supabase
            .from('tutor_logs_topics_students')
            .insert(topicStudentsPayload);

          if (topicStudentsError) throw topicStudentsError;
        }
      }

      // 6. Create topic file records
      if (data.topicFiles.length > 0) {
        const topicFilesPayload = data.topicFiles.map((tf) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          topics_files_id: tf.topicsFilesId,
          created_by: createdBy,
        }));

        const { data: createdTopicFiles, error: topicFilesError } = await supabase
          .from('tutor_logs_topics_files')
          .insert(topicFilesPayload)
          .select();

        if (topicFilesError) throw topicFilesError;

        // 7. Create topic file-student links
        const topicFileStudentsPayload: TablesInsert<'tutor_logs_topics_files_students'>[] = [];
        data.topicFiles.forEach((tf) => {
          const tutorLogTopicFileRecord = createdTopicFiles?.find(
            (ctf: any) => ctf.topics_files_id === tf.topicsFilesId
          );
          if (tutorLogTopicFileRecord) {
            tf.studentIds.forEach((studentId) => {
              topicFileStudentsPayload.push({
                id: crypto.randomUUID(),
                tutor_logs_topics_files_id: tutorLogTopicFileRecord.id,
                student_id: studentId,
                created_by: createdBy,
              });
            });
          }
        });

        if (topicFileStudentsPayload.length > 0) {
          const { error: topicFileStudentsError } = await supabase
            .from('tutor_logs_topics_files_students')
            .insert(topicFileStudentsPayload);

          if (topicFileStudentsError) throw topicFileStudentsError;
        }
      }

      // 8. Create notes
      if (data.notes.length > 0) {
        const notesPayload = data.notes.map((note) => ({
          id: crypto.randomUUID(),
          target_type: 'tutor_logs',
          target_id: tutorLogId,
          note: note,
          created_by: createdBy,
        }));

        const { error: notesError } = await supabase
          .from('notes')
          .insert(notesPayload);

        if (notesError) throw notesError;
      }

      return tutorLog as Tables<'tutor_logs'>;
    } catch (error) {
      console.error('Error creating tutor log:', error);
      throw error;
    }
  },

  /**
   * Get a single tutor log with all related data
   */
  getTutorLog: async (id: string): Promise<TutorLogWithDetails | null> => {
    const supabase = getSupabaseClient();

    try {
      const { data: tutorLog, error: tutorLogError } = await supabase
        .from('tutor_logs')
        .select(`
          *,
          session:sessions!inner(
            *,
            class:classes!inner(
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
      console.error('Error getting tutor log:', error);
      throw error;
    }
  },

  /**
   * Check if a session has been logged
   */
  getTutorLogForSession: async (sessionId: string): Promise<Tables<'tutor_logs'> | null> => {
    const { data, error } = await getSupabaseClient()
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
    const supabase = getSupabaseClient();

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
        // .lte('start_at', new Date().toISOString())
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
      console.error('Error getting unlogged sessions:', error);
      throw error;
    }
  },

  /**
   * Get all tutor logs (admin only)
   */
  getAllTutorLogs: async (): Promise<Tables<'tutor_logs'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('tutor_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Tables<'tutor_logs'>[];
  },

  /**
   * Update a tutor log (admin only)
   */
  updateTutorLog: async (id: string, updates: Partial<TutorLogFormData>): Promise<void> => {
    // This is complex - for now, just throw an error
    // In a real implementation, you'd need to diff the changes and update accordingly
    throw new Error('Tutor log updates not yet implemented');
  },

  /**
   * Delete a tutor log (admin only)
   * This will cascade delete all related records
   */
  deleteTutorLog: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('tutor_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

