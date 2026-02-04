import { useState, useEffect, useMemo } from 'react';
import { sessionsApi } from '../api/sessions';
import { tutorLogsApi } from '@/features/tutor-logs/api/tutor-logs';
import type { Tables } from '@altitutor/shared';

export interface UseSessionModalDataProps {
  isOpen: boolean;
  sessionId: string | null;
}

export interface ProcessedStudent {
  student: Tables<'students'>;
  plannedStatus: 'attending' | 'absent';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
}

export interface ProcessedStaff {
  staff: Tables<'staff'>;
  plannedStatus: 'attending';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
  staffType?: string;
}

export interface UseSessionModalDataReturn {
  // Data
  session: any | null;
  tutorLog: any | null;
  allTopics: Tables<'topics'>[];
  studentsData: ProcessedStudent[];
  staffData: ProcessedStaff[];
  subject: Tables<'subjects'> | null;
  
  // State
  isLoading: boolean;
  
  // Actions
  refresh: () => Promise<void>;
}

/**
 * Hook for loading and processing session modal data
 * Handles fetching session, tutor log, topics, and processing attendance data
 */
export function useSessionModalData({
  isOpen,
  sessionId,
}: UseSessionModalDataProps): UseSessionModalDataReturn {
  const [data, setData] = useState<any>(null);
  const [tutorLog, setTutorLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);

  const load = async () => {
    if (!isOpen || !sessionId) return;
    setIsLoading(true);
    try {
      // Use getSessionWithDetails which returns data from vtutor_session_detail view
      const result = await sessionsApi.getSessionWithDetails(sessionId);
      setData(result);
      
      // Fetch tutor log for this session
      const logResult = await tutorLogsApi.getTutorLogBySessionId(sessionId);
      setTutorLog(logResult);
      
      // Fetch all topics for the subject to derive topic codes
      // Use session's subject_id from result
      const subjectId = result?.subject_id;
      if (subjectId) {
        const { topicsApi } = await import('@/features/topics/api');
        const topicsData = await topicsApi.getTopicsBySubject(subjectId);
        // Filter to ensure valid topics
        const validTopics = (topicsData || []).filter((t: any): t is any => 
          t && typeof t.id === 'string' && typeof t.name === 'string'
        );
        setAllTopics(validTopics as any);
      }
      
      // Also fetch topics if tutor log exists and has topics with subject_id
      if (logResult?.topics && Array.isArray(logResult.topics) && logResult.topics.length > 0) {
        const firstTopic = logResult.topics[0] as any;
        const topicSubjectId = firstTopic?.subject_id;
        if (topicSubjectId && topicSubjectId !== subjectId) {
          // If different subject, fetch those topics too
          const { topicsApi } = await import('@/features/topics/api');
          const topicsData = await topicsApi.getTopicsBySubject(topicSubjectId);
          const validTopics = (topicsData || []).filter((t: any): t is any => 
            t && typeof t.id === 'string' && typeof t.name === 'string'
          );
          // Merge with existing topics
          setAllTopics((prev) => {
            const existingIds = new Set(prev.map((t: any) => t.id));
            const newTopics = validTopics.filter((t: any) => !existingIds.has(t.id));
            return [...prev, ...newTopics] as any;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      load();
    } else if (!isOpen) {
      // Delay state reset to allow exit animation to complete
      const timer = setTimeout(() => {
        setData(null);
        setTutorLog(null);
        setAllTopics([]);
      }, 300); // Match Sheet animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, sessionId]);

  const refresh = async () => {
    if (!sessionId) return;
    try {
      const result = await sessionsApi.getSessionWithDetails(sessionId);
      setData(result);
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  // Process session data
  const session = data;
  const sessionsStudents = useMemo(() => {
    return (data?.students || []).map((student: any) => ({
      student_id: student.id,
      student: student,
      planned_absence: student.planned_absence,
      is_rescheduled: student.is_rescheduled,
      is_credited: student.is_credited,
    }));
  }, [data?.students]);

  const sessionsStaff = useMemo(() => {
    return (data?.staff || []).map((staffMember: any) => ({
      staff_id: staffMember.id,
      staff: staffMember,
      type: staffMember.type,
    }));
  }, [data?.staff]);

  // Build subject object from flattened fields
  const subject = useMemo(() => {
    return (session as any)?.subject_name ? {
      id: (session as any).subject_id,
      name: (session as any).subject_name,
      curriculum: (session as any).subject_curriculum,
      discipline: (session as any).subject_discipline,
      level: (session as any).subject_level,
      color: (session as any).subject_color,
      year_level: (session as any).subject_year_level,
      short_name: (session as any).subject_short_name,
      long_name: (session as any).subject_long_name,
    } as Tables<'subjects'> : null;
  }, [session]);

  // Build student attendance map from tutor log
  const actualStudentAttendance = useMemo(() => {
    const attendance: Record<string, { attended: boolean; was_trial?: boolean }> = {};
    if (tutorLog?.student_attendance) {
      tutorLog.student_attendance.forEach((att: any) => {
        attendance[att.student_id] = { 
          attended: att.attended,
          was_trial: att.was_trial ?? false
        };
      });
    }
    return attendance;
  }, [tutorLog?.student_attendance]);

  // Build staff attendance map from tutor log
  const actualStaffAttendance = useMemo(() => {
    const attendance: Record<string, { attended: boolean; type?: string }> = {};
    if (tutorLog?.staff_attendance) {
      tutorLog.staff_attendance.forEach((att: any) => {
        attendance[att.staff_id] = { attended: att.attended, type: att.type };
      });
    }
    return attendance;
  }, [tutorLog?.staff_attendance]);

  const hasTutorLog = !!tutorLog;

  // Process students with attendance status
  const studentsData = useMemo(() => {
    return sessionsStudents.map((ss: any) => {
      const wasTrialPlanned = ss.was_trial ?? false;
      const plannedStatus: 'attending' | 'attending-trial' | 'absent' = ss.planned_absence 
        ? 'absent' 
        : wasTrialPlanned 
        ? 'attending-trial' 
        : 'attending';
      const actualAttendance = actualStudentAttendance[ss.student_id || ss.student?.id];
      const wasTrialActual = actualAttendance?.was_trial ?? false;
      const actualStatus = !hasTutorLog
        ? 'not-logged' as const
        : actualAttendance?.attended
        ? (wasTrialActual ? 'attended-trial' as const : 'attended' as const)
        : 'did-not-attend' as const;
      
      return {
        student: ss.student,
        plannedStatus,
        actualStatus,
      };
    });
  }, [sessionsStudents, actualStudentAttendance, hasTutorLog]);

  // Process staff with attendance status
  const staffData = useMemo(() => {
    return sessionsStaff.map((sf: any) => {
      const plannedStatus: 'attending' = 'attending' as const;
      const actualAttendance = actualStaffAttendance[sf.staff_id];
      const actualStatus = !hasTutorLog
        ? 'not-logged' as const
        : actualAttendance?.attended
        ? 'attended' as const
        : 'did-not-attend' as const;
      
      return {
        staff: sf.staff,
        plannedStatus,
        actualStatus,
        staffType: actualAttendance?.type,
      };
    });
  }, [sessionsStaff, actualStaffAttendance, hasTutorLog]);

  return {
    session,
    tutorLog,
    allTopics,
    studentsData,
    staffData,
    subject,
    isLoading,
    refresh,
  };
}
