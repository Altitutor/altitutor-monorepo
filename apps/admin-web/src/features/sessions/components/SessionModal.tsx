'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { format } from 'date-fns';
import { ExternalLink, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '../api/sessions';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { StudentAvatar } from './StudentAvatar';
import { AttendanceCell } from './AttendanceCell';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { formatSubjectDisplay } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { getSubjectColorStyle } from '@/shared/utils';
import { Check } from 'lucide-react';
import { SessionFiles } from './SessionFiles';
import { formatTime } from '@/shared/utils/datetime';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const openWindow = useChatStore(s => s.openWindow);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !sessionId) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(sessionId);
        setData(result);
        
        // Fetch all topics for the subject to derive topic codes
        // Use session's subject if available, otherwise fall back to class's subject
        const subjectId = (result.session as any)?.subject?.id || result.session?.class?.subject?.id;
        if (subjectId) {
          const supabaseClient = (await import('@/shared/lib/supabase/client')).getSupabaseClient() as SupabaseClient<Database>;
          const { data: topicsData } = await supabaseClient
            .from('topics')
            .select('*')
            .eq('subject_id', subjectId)
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
        <SheetContent className="w-full md:w-[600px] md:max-w-none overflow-y-auto p-0">
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
  // Build set of student IDs that are in sessions_students (planned students)
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss: any) => ss.student_id && !ss.is_extra)
      .map((ss: any) => ss.student_id)
  );
  
  const studentsData = sessionsStudents.map((ss: any) => {
    let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
    let rescheduledDate = '';
    
    // Check if this is an unplanned student (not in sessions_students originally)
    // Unplanned students don't have a sessions_students_id (it's null/undefined)
    // They are in the tutor log but not in sessions_students
    const isUnplanned = (ss.sessions_students_id === null || ss.sessions_students_id === undefined) && ss.is_extra;
    
    if (ss.planned_absence && !isUnplanned) {
      // Only mark as absent if it's a planned student with planned absence
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
      // Unplanned student (attended but not in sessions_students)
      plannedStatus = 'unplanned';
    } else if (ss.is_extra && plannedStudentIds.has(ss.student_id)) {
      // Planned extra student (in sessions_students but marked as extra)
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
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            {/* Sticky Header */}
            <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
              <SheetHeader className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <SheetTitle>Session Details</SheetTitle>
                    <SheetDescription className="text-lg font-medium">
                      {sessionTitle}
                    </SheetDescription>
                  </div>
                  {sessionId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        router.push(`/sessions/${sessionId}`);
                        onClose();
                      }}
                      className="shrink-0"
                      title="Open in new page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="px-6 pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 relative">
              <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
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
                <h3 className="text-lg font-semibold mb-4">Students ({studentsData.length})</h3>
                {studentsData.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No students planned
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Planned Attendance</TableHead>
                          <TableHead>Actual Attendance</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsData.map((data: any) => (
                          <TableRow key={data.student.id}>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(data.student.id);
                                  setIsStudentModalOpen(true);
                                }}
                                className="text-left hover:underline font-medium"
                              >
                                {data.student.first_name} {data.student.last_name}
                              </button>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
                              <AttendanceCell status={data.actualStatus} />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const status = data.invoice_status;
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
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedStudentId(data.student.id);
                                      setIsStudentModalOpen(true);
                                    }}
                                  >
                                    View Student
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMessageStudent(data.student.id);
                                    }}
                                  >
                                    Message
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Separator />

              {/* Staff Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Staff ({staffData.length})</h3>
                {staffData.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No staff planned
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Planned Attendance</TableHead>
                          <TableHead>Actual Attendance</TableHead>
                          <TableHead>Tutor Log</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffData.map((data: any) => (
                          <TableRow key={data.staff.id}>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => handleOpenStaff(data.staff.id)}
                                className="text-left hover:underline font-medium"
                              >
                                {data.staff.first_name} {data.staff.last_name}
                              </button>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
                              <AttendanceCell status={data.actualStatus} staffType={data.staffType} />
                            </TableCell>
                            <TableCell>
                              {data.submittedTutorLog && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenStaff(data.staff.id);
                                    }}
                                  >
                                    View Staff
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMessageStaff(data.staff.id);
                                    }}
                                  >
                                    Message
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

              {/* Session Files Section */}
              {sessionId && (
                <>
                  <SessionFiles sessionId={sessionId} />
                </>
              )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
                  {sessionId && (
                    <SessionActivityTab sessionId={sessionId} isOpen={isOpen} />
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
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
