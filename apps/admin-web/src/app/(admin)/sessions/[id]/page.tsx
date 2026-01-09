'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, Separator } from '@altitutor/ui';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { getSessionTitle, formatSessionDate } from '@/features/sessions/utils/session-helpers';
import { StudentAvatar } from '@/features/sessions/components/StudentAvatar';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { StudentCard } from '@/shared/components/StudentCard';
import { StaffCard } from '@/shared/components/StaffCard';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { SessionNotes } from '@/features/sessions/components/SessionNotes';
import { Check, X } from 'lucide-react';

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
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
      if (!id) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(id);
        setData(result);
        
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
    
    if (id) {
      load();
    }
  }, [id]);

  const handleOpenSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleOpenStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleOpenTopic = (topicId: string) => {
    // Get subject ID from session's subject if available, otherwise from class's subject
    const subjectId = (data?.session as any)?.subject?.id || data?.session?.class?.subject?.id;
    if (subjectId) {
      router.push(`/subjects/${subjectId}/topics/${topicId}`);
    } else {
      // Fallback to old route if subject not available
      router.push(`/topics/${topicId}`);
    }
  };

  const handleOpenFile = (fileId: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id: fileId } }));
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        openWindow({ conversationId, title: 'Student' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        openWindow({ conversationId, title: 'Staff' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.session) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/sessions')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Session Not Found</h1>
        </div>
      </div>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog, notes } = data;
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;
  // Use session's subject if available, otherwise fall back to class's subject
  const subject = (session as any).subject || session.class?.subject;

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
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss: any) => ss.student_id && !ss.is_extra)
      .map((ss: any) => ss.student_id)
  );
  
  const studentsData = sessionsStudents.map((ss: any) => {
    let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
    let rescheduledDate = '';
    
    const isUnplanned = (ss.sessions_students_id === null || ss.sessions_students_id === undefined) && ss.is_extra;
    
    if (ss.planned_absence && !isUnplanned) {
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
    } else if (isUnplanned) {
      plannedStatus = 'unplanned';
    } else if (ss.is_extra && plannedStudentIds.has(ss.student_id)) {
      plannedStatus = 'attending-extra';
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
      invoiceStatus: ss.invoice_status || null,
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
    
    const submittedTutorLog = tutorLog?.created_by === sf.staff_id;
    
    return {
      staff: sf.staff,
      plannedStatus,
      actualStatus,
      staffType: actualAttendance?.type,
      swappedStaffName,
      swappedStaffId,
      submittedTutorLog,
    };
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/sessions')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Session Details</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {sessionTitle}
          </p>
        </div>
      </div>

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
                if (session.class?.start_time && session.class?.end_time) {
                  return `${formatTime(session.class.start_time)} - ${formatTime(session.class.end_time)}`;
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
                <span className="text-xs text-muted-foreground">Invoice</span>
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
                    <div className="w-16 flex justify-center">
                      {(() => {
                        const status = data.invoiceStatus;
                        if (!status) return <span className="text-xs text-muted-foreground">-</span>;
                        
                        let label = '';
                        let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
                        
                        if (status === 'draft' || status === 'open') {
                          label = 'Sent';
                          variant = 'secondary';
                        } else if (status === 'paid') {
                          label = 'Paid';
                          variant = 'default';
                        } else if (status === 'void' || status === 'uncollectible' || status === 'disputed') {
                          label = 'Failed';
                          variant = 'destructive';
                        } else {
                          label = status;
                          variant = 'outline';
                        }
                        
                        return <Badge variant={variant} className="text-xs">{label}</Badge>;
                      })()}
                    </div>
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
                <span className="text-xs text-muted-foreground">Tutor Log</span>
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
                    <div className="w-16 flex justify-center">
                      {data.submittedTutorLog ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-600" />
                      )}
                    </div>
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
                  const topic = allTopics.find(t => t.id === topicData.topic?.id) || topicData.topic;
                  const topicCode = topic?.code || '';
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
                              
                              const fileCode = topicFile.code || '';
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

        <Separator />

        {/* Session Notes Section */}
        <SessionNotes
          sessionId={id}
          notes={(notes as any) || []}
          onNoteAdded={() => {
            if (id) {
              sessionsApi.getSessionWithTutorLog(id).then((result) => {
                setData(result);
              }).catch((error) => {
                console.error('Failed to refresh session:', error);
              });
            }
          }}
        />
      </div>

      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
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
          onStaffUpdated={() => {}}
        />
      )}
    </div>
  );
}
