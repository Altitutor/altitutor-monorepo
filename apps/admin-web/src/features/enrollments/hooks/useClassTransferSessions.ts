import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface ClassTransferSession {
  id: string;
  class_id: string;
  start_at: string;
  end_at: string;
  subject_id: string;
  billing_type: string | null;
  logged: boolean;
  studentAttended: boolean;
}

export async function fetchOpenEnrolmentStart(studentId: string, classId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from('classes_students')
    .select('enrolled_at')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.enrolled_at ?? null;
}

export function useOpenEnrolmentStart(studentId: string, classId: string) {
  return useQuery({
    queryKey: ['open-enrolment-start', studentId, classId],
    enabled: !!studentId && !!classId,
    queryFn: () => fetchOpenEnrolmentStart(studentId, classId),
  });
}

/** Choose materialised lessons, including custom/fortnightly timetables and exceptions. */
export function useClassTransferSessions(oldClassId: string, newClassId?: string, studentId?: string) {
  const query = useQuery({
    queryKey: ['class-transfer-sessions', oldClassId, newClassId, studentId],
    enabled: !!oldClassId && !!newClassId,
    queryFn: async (): Promise<{ sessions: ClassTransferSession[]; enrolledAt: string | null }> => {
      const now = Date.now();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sessions')
        .select('id, class_id, start_at, end_at, billing_type, subject_id')
        .in('class_id', [oldClassId, newClassId!])
        .eq('status', 'ACTIVE')
        .is('calendar_tombstone_until', null)
        .gte('start_at', new Date(now - 90 * 86400000).toISOString())
        .lte('start_at', new Date(now + 365 * 86400000).toISOString())
        .order('start_at')
        .limit(1000);
      if (error) throw error;

      const oldIds = (data ?? []).flatMap((session) => (
        session.class_id === oldClassId && session.id ? [session.id] : []
      ));
      const loggedIds = new Set<string>();
      const attendedIds = new Set<string>();
      if (studentId && oldIds.length > 0) {
        const { data: logs, error: logsError } = await supabase
          .from('tutor_logs')
          .select('id, session_id')
          .in('session_id', oldIds);
        if (logsError) throw logsError;
        const logRows = logs ?? [];
        for (const log of logRows) {
          if (log.session_id) loggedIds.add(log.session_id);
        }
        const logIds = logRows.flatMap((log) => (log.id ? [log.id] : []));
        if (logIds.length > 0) {
          const { data: attendance, error: attendanceError } = await supabase
            .from('tutor_logs_student_attendance')
            .select('tutor_log_id')
            .eq('student_id', studentId)
            .eq('attended', true)
            .in('tutor_log_id', logIds);
          if (attendanceError) throw attendanceError;
          const sessionByLog = new Map(logRows.flatMap((log) => (
            log.id && log.session_id ? [[log.id, log.session_id] as const] : []
          )));
          for (const row of attendance ?? []) {
            const sessionId = sessionByLog.get(row.tutor_log_id);
            if (sessionId) attendedIds.add(sessionId);
          }
        }
      }

      const sessions = (data ?? []).flatMap((session): ClassTransferSession[] => {
        const { id, class_id, start_at, end_at, subject_id, billing_type } = session;
        return id && class_id && start_at && end_at && subject_id
          ? [{
            id,
            class_id,
            start_at,
            end_at,
            subject_id,
            billing_type,
            logged: loggedIds.has(id),
            studentAttended: attendedIds.has(id),
          }]
          : [];
      });
      const enrolledAt = studentId ? await fetchOpenEnrolmentStart(studentId, oldClassId) : null;
      return { sessions, enrolledAt };
    },
  });

  return {
    ...query,
    data: query.data?.sessions,
    enrolledAt: query.data?.enrolledAt ?? null,
  };
}

export function sessionCalendarDate(startAt: string, timezone = 'Australia/Adelaide'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(startAt));
}

export function sessionDateLabel(startAt: string, timezone = 'Australia/Adelaide'): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(startAt));
}
