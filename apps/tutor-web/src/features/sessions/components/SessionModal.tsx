'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button } from '@altitutor/ui';
import { Separator, Badge } from '@altitutor/ui';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import { sessionsApi } from '../api/sessions';
import { tutorLogsApi } from '@/features/tutor-logs/api/tutor-logs';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { StudentCard, StaffCard } from '@/shared/components';
import { AttendanceCell } from './AttendanceCell';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { useSessionNotes } from '../hooks/useSessionNotes';
import { SessionNotes } from './SessionNotes';
import { LogSessionModal } from '@/features/tutor-logs/components/LogSessionModal';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { StudentAvatar } from './StudentAvatar';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const [data, setData] = useState<any>(null);
  const [tutorLog, setTutorLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  
  // Fetch session notes
  const { data: notesData } = useSessionNotes(sessionId || '');
  const { data: currentStaff } = useCurrentStaff();

  useEffect(() => {
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

  // Always render the Sheet to allow exit animation
  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>{isLoading ? 'Loading...' : ''}</SheetTitle>
            </SheetHeader>
            {isLoading && (
              <div className="py-6 text-center text-muted-foreground">Loading session details...</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // The data from vtutor_session_detail is a single row with flattened fields
  const session = data;
  const sessionsStudents = (data.students || []).map((student: any) => ({
    student_id: student.id,
    student: student,
    planned_absence: student.planned_absence,
    is_rescheduled: student.is_rescheduled,
    is_credited: student.is_credited,
  }));
  const sessionsStaff = (data.staff || []).map((staffMember: any) => ({
    staff_id: staffMember.id,
    staff: staffMember,
    type: staffMember.type,
  }));
  
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;
  
  // Build subject object from flattened fields
  const subject = (session as any).subject_name ? {
    id: (session as any).subject_id,
    name: (session as any).subject_name,
    curriculum: (session as any).subject_curriculum,
    discipline: (session as any).subject_discipline,
    level: (session as any).subject_level,
    color: (session as any).subject_color,
    year_level: (session as any).subject_year_level,
  } as Tables<'subjects'> : null;

  // Build student attendance map from tutor log
  const actualStudentAttendance: Record<string, { attended: boolean }> = {};
  if (tutorLog?.student_attendance) {
    tutorLog.student_attendance.forEach((att: any) => {
      actualStudentAttendance[att.student_id] = { attended: att.attended };
    });
  }

  // Build staff attendance map from tutor log
  const actualStaffAttendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staff_attendance) {
    tutorLog.staff_attendance.forEach((att: any) => {
      actualStaffAttendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }

  // Process students with attendance status
  const studentsData = sessionsStudents.map((ss: any) => {
    const plannedStatus: 'attending' | 'absent' = ss.planned_absence ? 'absent' : 'attending';
    const actualAttendance = actualStudentAttendance[ss.student_id || ss.student?.id];
    const actualStatus = !hasTutorLog
      ? 'not-logged' as const
      : actualAttendance?.attended
      ? 'attended' as const
      : 'did-not-attend' as const;
    
    return {
      student: ss.student,
      plannedStatus,
      actualStatus,
    };
  });

  // Process staff with attendance status
  const staffData = sessionsStaff.map((sf: any) => {
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

  const handleRefresh = async () => {
    if (!sessionId) return;
    try {
      const result = await sessionsApi.getSessionWithDetails(sessionId);
      setData(result);
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
        <div className="flex-1 overflow-y-auto p-6">
          <SheetHeader className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>Session Details</SheetTitle>
                <SheetDescription className="text-lg font-medium">
                  {sessionTitle}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="space-y-6">
            {/* Session Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Session Information</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium text-muted-foreground">Day:</div>
                <div className="text-sm">{session.start_at ? formatSessionDate(session.start_at) : '—'}</div>
                
                <div className="text-sm font-medium text-muted-foreground">Time:</div>
                <div className="text-sm">
                  {(() => {
                    if (session.start_at && session.end_at) {
                      const startDate = new Date(session.start_at);
                      const endDate = new Date(session.end_at);
                      const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
                      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                      return `${formatTime(startTime)} - ${formatTime(endTime)}`;
                    }
                    // Check for flattened structure (from vtutor_session_detail)
                    if ((session as any).start_time && (session as any).end_time) {
                      return `${formatTime((session as any).start_time)} - ${formatTime((session as any).end_time)}`;
                    }
                    return '—';
                  })()}
                </div>
                
                <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                <div className="text-sm">
                  {subject ? (() => {
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge 
                        className={defaultClass || textColorClass}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectDisplay(subject)}
                      </Badge>
                    );
                  })() : (
                    '—'
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Students Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Students ({studentsData.length})</h3>
                {studentsData.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">Planned</span>
                    <span className="text-xs text-muted-foreground">Actual</span>
                  </div>
                )}
              </div>
              {studentsData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No students planned
                </div>
              ) : (
                <div className="space-y-3">
                  {studentsData.map((data: any) => (
                    <div key={data.student.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <StudentCard
                          student={data.student}
                          showSubjects={false}
                        />
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <AttendanceCell status={data.plannedStatus} />
                        <AttendanceCell status={data.actualStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Staff Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Staff ({staffData.length})</h3>
                {staffData.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">Planned</span>
                    <span className="text-xs text-muted-foreground">Actual</span>
                  </div>
                )}
              </div>
              {staffData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No staff planned
                </div>
              ) : (
                <div className="space-y-3">
                  {staffData.map((data: any) => (
                    <div key={data.staff.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <StaffCard
                          staff={data.staff}
                          subjects={data.staff.subjects || []}
                          showSubjects={false}
                        />
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <AttendanceCell status={data.plannedStatus} />
                        <AttendanceCell status={data.actualStatus} staffType={data.staffType} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Tutor Log Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tutor Log</h3>
                {!hasTutorLog && sessionId && currentStaff?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLogSessionModalOpen(true)}
                  >
                    Add Tutor Log
                  </Button>
                )}
              </div>

              {/* Topics Covered Section */}
              {hasTutorLog && tutorLog.topics && tutorLog.topics.length > 0 && (
                <div className="space-y-4 mb-4">
                  {tutorLog.topics.map((topicData: any) => {
                    // vtutor_tutor_log returns topics with topic_id, topic_name, etc.
                    // Find the complete topic record from allTopics
                    const topic = allTopics.find(t => t.id === topicData.topic_id);
                    const topicName = topicData.topic_name || topic?.name || 'Unknown Topic';
                    const topicCode = topic?.code || '';
                    
                    // Get files for this topic from tutorLog.files
                    const topicFiles = (tutorLog.files || []).filter((f: any) => f.topic_id === topicData.topic_id);
                    
                    // Get student IDs from topicData.student_ids (array of IDs)
                    const studentIds = topicData.student_ids || [];
                    
                    return (
                      <div key={topicData.id} className="border rounded-lg p-4 space-y-3">
                        <div>
                          <div className="font-medium">
                            {topicCode ? `${topicCode} ` : ''}{topicName}
                          </div>
                        </div>
                        
                        {topicFiles.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Files:</div>
                            <div className="space-y-1">
                              {topicFiles.map((fileData: any) => {
                                const fileCode = fileData.code || fileData.filename || '';
                                
                                return (
                                  <div
                                    key={fileData.id}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {fileCode}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {studentIds.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                            <div className="text-sm text-muted-foreground">
                              {studentIds.length} student{studentIds.length !== 1 ? 's' : ''} assigned
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No Tutor Log Message */}
              {!hasTutorLog && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  This session has not been logged yet.
                </div>
              )}
            </div>

            <Separator />

            {/* Session Notes Section */}
            {sessionId && (
              <SessionNotes
                sessionId={sessionId}
                notes={(notesData || []) as any}
                onNoteAdded={handleRefresh}
              />
            )}
          </div>
        </div>
      </SheetContent>
      
      {/* Log Session Modal */}
      {currentStaff?.id && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={() => {
            setIsLogSessionModalOpen(false);
            // Refresh session data to show new tutor log
            if (sessionId) {
              handleRefresh();
            }
          }}
          currentStaffId={currentStaff.id}
          preselectedSessionId={sessionId || undefined}
        />
      )}
    </Sheet>
  );
}
