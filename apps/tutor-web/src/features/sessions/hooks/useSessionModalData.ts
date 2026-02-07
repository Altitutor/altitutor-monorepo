import { useState, useEffect, useMemo, useCallback } from 'react';
import { sessionsApi } from '../api/sessions';
import { tutorLogsApi } from '@/features/tutor-logs/api/tutor-logs';
import type { Tables } from '@altitutor/shared';
import type { FlattenedSessionDetail, SessionStaff, SessionStudent } from '../utils/session-helpers';

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

interface TutorLogStudentAttendance {
  student_id: string;
  attended: boolean;
  was_trial?: boolean;
}

interface TutorLogStaffAttendance {
  staff_id: string;
  attended: boolean;
  type?: string;
}

interface TutorLog {
  id: string;
  tutor_log_id: string | null;
  student_attendance?: TutorLogStudentAttendance[];
  staff_attendance?: TutorLogStaffAttendance[];
  topics?: Array<{ id: string; name: string; subject_id: string }>;
  files?: Array<{ id: string; topic_id: string; code?: string; filename?: string }>;
}

export interface UseSessionModalDataReturn {
  // Data
  session: FlattenedSessionDetail | null;
  tutorLog: TutorLog | null;
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
  const [data, setData] = useState<FlattenedSessionDetail | null>(null);
  const [tutorLog, setTutorLog] = useState<TutorLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);

  const load = useCallback(async () => {
    if (!isOpen || !sessionId) return;
    setIsLoading(true);
    try {
      // Use getSessionWithDetails which returns data from vtutor_session_detail view
      const result = await sessionsApi.getSessionWithDetails(sessionId);
      // Transform result to match FlattenedSessionDetail type
      if (result && result.session_id) {
        // Parse JSON fields with proper type guards
        const parseStudents = (json: unknown): SessionStudent[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          return json.map(item => {
            if (typeof item === 'object' && item !== null && 'id' in item && 'first_name' in item && 'last_name' in item) {
              return {
                id: String(item.id),
                first_name: String(item.first_name),
                last_name: String(item.last_name),
                year_level: 'year_level' in item && (typeof item.year_level === 'number' || item.year_level === null)
                  ? item.year_level
                  : null,
              };
            }
            return null;
          }).filter((item): item is SessionStudent => item !== null);
        };
        
        const parseStaff = (json: unknown): SessionStaff[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: SessionStaff[] = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'id' in item && 'first_name' in item && 'last_name' in item && 'role' in item) {
              const staff: SessionStaff = {
                id: String(item.id),
                first_name: String(item.first_name),
                last_name: String(item.last_name),
                role: String(item.role),
              };
              if ('type' in item && typeof item.type === 'string') {
                staff.type = item.type;
              }
              if ('subjects' in item && Array.isArray(item.subjects)) {
                const subjects: Array<{ id: string; name: string }> = [];
                for (const subj of item.subjects) {
                  if (typeof subj === 'object' && subj !== null && 'id' in subj && 'name' in subj) {
                    subjects.push({ id: String(subj.id), name: String(subj.name) });
                  }
                }
                if (subjects.length > 0) {
                  staff.subjects = subjects;
                }
              }
              result.push(staff);
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        const students = parseStudents(result.students);
        const staff = parseStaff(result.staff);
        
        setData({
          ...result,
          session_id: result.session_id,
          students,
          staff,
        } as FlattenedSessionDetail);
      } else {
        setData(null);
      }
      
      // Fetch tutor log for this session
      const logResult = await tutorLogsApi.getTutorLogBySessionId(sessionId);
      // Transform logResult to match TutorLog type
      if (logResult && logResult.tutor_log_id) {
        // Parse JSON arrays with proper type guards
        const parseStudentAttendance = (json: unknown): TutorLogStudentAttendance[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: TutorLogStudentAttendance[] = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'student_id' in item && 'attended' in item) {
              result.push({
                student_id: String(item.student_id),
                attended: Boolean(item.attended),
                was_trial: 'was_trial' in item ? Boolean(item.was_trial) : undefined,
              });
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        const parseStaffAttendance = (json: unknown): TutorLogStaffAttendance[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: TutorLogStaffAttendance[] = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'staff_id' in item && 'attended' in item) {
              result.push({
                staff_id: String(item.staff_id),
                attended: Boolean(item.attended),
                type: 'type' in item && typeof item.type === 'string' ? item.type : undefined,
              });
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        const parseTopics = (json: unknown): Array<{ id: string; name: string; subject_id: string }> | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: Array<{ id: string; name: string; subject_id: string }> = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'subject_id' in item) {
              result.push({
                id: String(item.id),
                name: String(item.name),
                subject_id: String(item.subject_id),
              });
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        const parseFiles = (json: unknown): Array<{ id: string; topic_id: string; code?: string; filename?: string }> | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: Array<{ id: string; topic_id: string; code?: string; filename?: string }> = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'id' in item && 'topic_id' in item) {
              result.push({
                id: String(item.id),
                topic_id: String(item.topic_id),
                code: 'code' in item && typeof item.code === 'string' ? item.code : undefined,
                filename: 'filename' in item && typeof item.filename === 'string' ? item.filename : undefined,
              });
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        setTutorLog({
          id: logResult.tutor_log_id,
          tutor_log_id: logResult.tutor_log_id,
          student_attendance: parseStudentAttendance(logResult.student_attendance),
          staff_attendance: parseStaffAttendance(logResult.staff_attendance),
          topics: parseTopics(logResult.topics),
          files: parseFiles(logResult.files),
        });
      } else {
        setTutorLog(null);
      }
      
      // Fetch all topics for the subject to derive topic codes
      // Use session's subject_id from result
      const subjectId = result?.subject_id;
      if (subjectId) {
        const { topicsApi } = await import('@/features/topics/api');
        const topicsData = await topicsApi.getTopicsBySubject(subjectId);
        // Filter to ensure valid topics
        const validTopics = (topicsData || []).filter((t): t is Tables<'topics'> => 
          t !== null && typeof t === 'object' && 'id' in t && 'name' in t &&
          typeof t.id === 'string' && typeof t.name === 'string'
        );
        setAllTopics(validTopics);
      }
      
      // Also fetch topics if tutor log exists and has topics with subject_id
      if (logResult?.topics && Array.isArray(logResult.topics) && logResult.topics.length > 0) {
        const firstTopic = logResult.topics[0];
        // Type guard to check if topic has subject_id
        const topicSubjectId = typeof firstTopic === 'object' && firstTopic !== null && 'subject_id' in firstTopic
          ? typeof firstTopic.subject_id === 'string' ? firstTopic.subject_id : undefined
          : undefined;
        if (topicSubjectId && topicSubjectId !== subjectId) {
          // If different subject, fetch those topics too
          const { topicsApi } = await import('@/features/topics/api');
          const topicsData = await topicsApi.getTopicsBySubject(topicSubjectId);
          const validTopics = (topicsData || []).filter((t): t is Tables<'topics'> => 
            t !== null && typeof t === 'object' && 'id' in t && 'name' in t &&
            typeof t.id === 'string' && typeof t.name === 'string'
          );
          // Merge with existing topics
          setAllTopics((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTopics = validTopics.filter((t) => !existingIds.has(t.id));
            return [...prev, ...newTopics];
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, sessionId]);

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
  }, [isOpen, sessionId, load]);

  const refresh = async () => {
    if (!sessionId) return;
    try {
      const result = await sessionsApi.getSessionWithDetails(sessionId);
      // Transform result to match FlattenedSessionDetail type
      if (result && result.session_id) {
        // Parse JSON fields with proper type guards
        const parseStudents = (json: unknown): SessionStudent[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          return json.map(item => {
            if (typeof item === 'object' && item !== null && 'id' in item && 'first_name' in item && 'last_name' in item) {
              return {
                id: String(item.id),
                first_name: String(item.first_name),
                last_name: String(item.last_name),
                year_level: 'year_level' in item && (typeof item.year_level === 'number' || item.year_level === null)
                  ? item.year_level
                  : null,
              };
            }
            return null;
          }).filter((item): item is SessionStudent => item !== null);
        };
        
        const parseStaff = (json: unknown): SessionStaff[] | undefined => {
          if (!Array.isArray(json)) return undefined;
          const result: SessionStaff[] = [];
          for (const item of json) {
            if (typeof item === 'object' && item !== null && 'id' in item && 'first_name' in item && 'last_name' in item && 'role' in item) {
              const staff: SessionStaff = {
                id: String(item.id),
                first_name: String(item.first_name),
                last_name: String(item.last_name),
                role: String(item.role),
              };
              if ('type' in item && typeof item.type === 'string') {
                staff.type = item.type;
              }
              if ('subjects' in item && Array.isArray(item.subjects)) {
                const subjects: Array<{ id: string; name: string }> = [];
                for (const subj of item.subjects) {
                  if (typeof subj === 'object' && subj !== null && 'id' in subj && 'name' in subj) {
                    subjects.push({ id: String(subj.id), name: String(subj.name) });
                  }
                }
                if (subjects.length > 0) {
                  staff.subjects = subjects;
                }
              }
              result.push(staff);
            }
          }
          return result.length > 0 ? result : undefined;
        };
        
        const students = parseStudents(result.students);
        const staff = parseStaff(result.staff);
        
        setData({
          ...result,
          session_id: result.session_id,
          students,
          staff,
        } as FlattenedSessionDetail);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  // Process session data
  const session = data;
  const sessionsStudents = useMemo(() => {
    const students = (data?.students || []) as SessionStudent[];
    return students.map((student) => ({
      student_id: student.id,
      student: student as unknown as Tables<'students'>,
      planned_absence: 'planned_absence' in student ? Boolean(student.planned_absence) : false,
      is_rescheduled: 'is_rescheduled' in student ? Boolean(student.is_rescheduled) : false,
      is_credited: 'is_credited' in student ? Boolean(student.is_credited) : false,
    }));
  }, [data?.students]);

  const sessionsStaff = useMemo(() => {
    const staff = (data?.staff || []) as SessionStaff[];
    return staff.map((staffMember) => ({
      staff_id: staffMember.id,
      staff: staffMember as unknown as Tables<'staff'>,
      type: staffMember.type,
    }));
  }, [data?.staff]);

  // Build subject object from flattened fields
  const subject = useMemo(() => {
    if (!session?.subject_name) return null;
    return {
      id: session.subject_id ?? '',
      name: session.subject_name,
      curriculum: session.subject_curriculum,
      discipline: session.subject_discipline,
      level: session.subject_level,
      color: session.subject_color,
      year_level: session.subject_year_level,
      short_name: session.subject_short_name,
      long_name: session.subject_long_name,
    } as Tables<'subjects'>;
  }, [session]);

  // Build student attendance map from tutor log
  const actualStudentAttendance = useMemo(() => {
    const attendance: Record<string, { attended: boolean; was_trial?: boolean }> = {};
    if (tutorLog?.student_attendance) {
      tutorLog.student_attendance.forEach((att) => {
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
      tutorLog.staff_attendance.forEach((att) => {
        attendance[att.staff_id] = { attended: att.attended, type: att.type };
      });
    }
    return attendance;
  }, [tutorLog?.staff_attendance]);

  const hasTutorLog = !!tutorLog;

  // Process students with attendance status
  const studentsData = useMemo(() => {
    return sessionsStudents.map((ss) => {
      const plannedStatus: 'attending' | 'absent' = ss.planned_absence 
        ? 'absent' 
        : 'attending';
      const studentId = ss.student_id || (ss.student && 'id' in ss.student ? String(ss.student.id) : '');
      const actualAttendance = studentId ? actualStudentAttendance[studentId] : undefined;
      const wasTrialActual = actualAttendance?.was_trial ?? false;
      const actualStatus = !hasTutorLog
        ? 'not-logged' as const
        : actualAttendance?.attended
        ? (wasTrialActual ? 'attended' as const : 'attended' as const)
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
    return sessionsStaff.map((sf) => {
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
