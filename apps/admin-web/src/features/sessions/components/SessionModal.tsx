'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { format } from 'date-fns';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '../api/sessions';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { StudentAvatar } from './StudentAvatar';
import { AttendanceCell } from './AttendanceCell';
import { deriveTopicCode, deriveTopicFileCode } from '@/features/topics/utils/codes';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { StudentCard } from '@/shared/components/StudentCard';
import { StaffCard } from '@/shared/components/StaffCard';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { formatSubjectDisplay } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { getSubjectColorStyle } from '@/shared/utils';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const openWindow = useChatStore(s => s.openWindow);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !sessionId) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(sessionId);
        setData(result);
        
        // Fetch all topics for the subject to derive topic codes
        if (result.session?.class?.subject?.id) {
          const supabaseClient = (await import('@/shared/lib/supabase/client')).getSupabaseClient() as SupabaseClient<Database>;
          const { data: topicsData } = await supabaseClient
            .from('topics')
            .select('*')
            .eq('subject_id', result.session.class.subject.id)
            .order('index', { ascending: true });
          
          setAllTopics(topicsData || []);
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
        setAllTopics([]);
      }, 300); // Match Sheet animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, sessionId]);

  const handleOpenSession = (id: string) => {
    // Close current modal and open new one
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id } }));
    }, 100);
  };

  const handleOpenStaff = (id: string) => {
    setSelectedStaffId(id);
    setIsStaffModalOpen(true);
  };

  const handleOpenTopic = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-topic-modal', { detail: { id } }));
  };

  const handleOpenFile = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Student' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Staff' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  // Always render the Sheet to allow exit animation
  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] max-w-[90vw] overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4">
            <SheetTitle>{isLoading ? 'Loading...' : ''}</SheetTitle>
          </SheetHeader>
          {isLoading && (
            <div className="py-6 text-center text-muted-foreground px-6">Loading session details...</div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog } = data;
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;
  const subject = session.class?.subject;

  // Build student attendance map from tutor log
  const actualStudentAttendance: Record<string, { attended: boolean }> = {};
  if (tutorLog?.studentAttendance) {
    tutorLog.studentAttendance.forEach((att: any) => {
      actualStudentAttendance[att.student_id] = { attended: att.attended };
    });
  }

  // Build staff attendance map from tutor log
  const actualStaffAttendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att: any) => {
      actualStaffAttendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }

  // Process students
  const studentsData = sessionsStudents.map((ss: any) => {
    let plannedStatus: 'attending' | 'absent' | 'rescheduled' | 'credited' = 'attending';
    let rescheduledDate = '';
    
    if (ss.planned_absence) {
      plannedStatus = 'absent';
      if (ss.is_rescheduled && ss.rescheduled_session?.session) {
        plannedStatus = 'rescheduled';
        const resSession = ss.rescheduled_session.session;
        rescheduledDate = resSession.start_at 
          ? `${format(new Date(resSession.start_at), 'EEE dd/MM')} ${resSession.class?.start_time || ''}`
          : '';
      } else if (ss.is_credited) {
        plannedStatus = 'credited';
      }
    }
    
    const actualAttendance = actualStudentAttendance[ss.student_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    return {
      student: ss.student,
      plannedStatus,
      actualStatus,
      rescheduledDate,
      rescheduledSessionId: ss.rescheduled_session?.session?.id,
    };
  });

  // Process staff
  const staffData = sessionsStaff.map((sf: any) => {
    let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';
    let swappedStaffName = '';
    let swappedStaffId = '';
    
    if (sf.planned_absence) {
      plannedStatus = 'absent';
      if (sf.is_swapped && sf.swapped_staff) {
        plannedStatus = 'swapped';
        swappedStaffName = `${sf.swapped_staff.first_name} ${sf.swapped_staff.last_name}`;
        swappedStaffId = sf.swapped_staff.id;
      }
    }
    
    const actualAttendance = actualStaffAttendance[sf.staff_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    return {
      staff: sf.staff,
      plannedStatus,
      actualStatus,
      staffType: actualAttendance?.type,
      swappedStaffName,
      swappedStaffId,
    };
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-[600px] max-w-[90vw]">
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>Session Details</SheetTitle>
              <SheetDescription className="text-lg font-medium">
                {sessionTitle}
              </SheetDescription>
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
                    {session.class?.start_time && session.class?.end_time
                      ? `${session.class.start_time} - ${session.class.end_time}`
                      : '—'}
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
                            onClick={() => {
                              setSelectedStudentId(data.student.id);
                              setIsStudentModalOpen(true);
                            }}
                            onMessage={() => handleMessageStudent(data.student.id)}
                            showSubjects={false}
                            showActions={true}
                          />
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <AttendanceCell
                            status={data.plannedStatus}
                            linkTo={
                              data.plannedStatus === 'rescheduled' && data.rescheduledSessionId
                                ? {
                                    type: 'session',
                                    id: data.rescheduledSessionId,
                                    onClick: () => handleOpenSession(data.rescheduledSessionId),
                                  }
                                : undefined
                            }
                            linkText={data.rescheduledDate}
                          />
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
                            onClick={() => handleOpenStaff(data.staff.id)}
                            onMessage={() => handleMessageStaff(data.staff.id)}
                            showSubjects={false}
                            showActions={true}
                          />
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <AttendanceCell
                            status={data.plannedStatus}
                            linkTo={
                              data.plannedStatus === 'swapped' && data.swappedStaffId
                                ? {
                                    type: 'staff',
                                    id: data.swappedStaffId,
                                    onClick: () => handleOpenStaff(data.swappedStaffId),
                                  }
                                : undefined
                            }
                            linkText={data.swappedStaffName}
                          />
                          <AttendanceCell status={data.actualStatus} staffType={data.staffType} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Topics Section */}
              {hasTutorLog && tutorLog.topics && tutorLog.topics.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Topics Covered</h3>
                    <div className="space-y-4">
                      {tutorLog.topics.map((topicData: any) => {
                        // Find the complete topic record from allTopics to ensure we have parent_id and index
                        const topic = allTopics.find(t => t.id === topicData.topic?.id) || topicData.topic;
                        const topicCode = deriveTopicCode(topic, allTopics);
                        const students = topicData.students || [];
                        const files = topicData.files || [];
                        
                        return (
                          <div key={topicData.id} className="border rounded-lg p-4 space-y-3">
                            <div>
                              <button
                                type="button"
                                className="text-accent-foreground hover:text-accent-foreground/80 hover:underline font-medium text-left"
                                onClick={() => handleOpenTopic(topic.id)}
                              >
                                {topicCode} {topic.name}
                              </button>
                            </div>
                            
                            {files.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Files:</div>
                                <div className="space-y-1">
                                  {files.map((fileData: any) => {
                                    const topicFile = fileData.topics_file;
                                    if (!topicFile) return null;
                                    
                                    const fileCode = deriveTopicFileCode(topicFile, topicCode, topicFile.type);
                                    const fileId = topicFile.file?.id;
                                    
                                    return (
                                      <button
                                        key={fileData.id}
                                        type="button"
                                        className="text-accent-foreground hover:text-accent-foreground/80 hover:underline block text-left text-sm"
                                        onClick={() => fileId && handleOpenFile(fileId)}
                                        disabled={!fileId}
                                      >
                                        {fileCode}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {students.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                                <div className="flex flex-wrap gap-1">
                                  {students.slice(0, 5).map((student: any) => (
                                    <button
                                      key={student.id}
                                      onClick={() => {
                                        setSelectedStudentId(student.id);
                                        setIsStudentModalOpen(true);
                                      }}
                                      className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                                    >
                                      <StudentAvatar student={student} size="sm" />
                                    </button>
                                  ))}
                                  {students.length > 5 && (
                                    <span className="text-xs text-muted-foreground self-center ml-1">
                                      +{students.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* No Tutor Log Message */}
              {!hasTutorLog && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  This session has not been logged yet.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          staffId={selectedStaffId}
          onStaffUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}
    </>
  );
}
