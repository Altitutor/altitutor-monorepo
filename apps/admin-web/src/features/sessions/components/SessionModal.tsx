'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@altitutor/ui';
import { Separator, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@altitutor/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import { sessionsApi } from '../api/sessions';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { StudentAvatar } from './StudentAvatar';
import { AttendanceCell } from './AttendanceCell';
import { deriveTopicCode, deriveTopicFileCode } from '@/features/topics/utils/codes';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !sessionId) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(sessionId);
        setData(result);
        
        // Fetch all topics for the subject to derive topic codes
        if (result.session?.class?.subject?.id) {
          const { data: topicsData } = await (await import('@/shared/lib/supabase/client')).getSupabaseClient()
            .from('topics')
            .select('*')
            .eq('subject_id', result.session.class.subject.id);
          setAllTopics(topicsData || []);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
    if (!isOpen) {
      setData(null);
      setAllTopics([]);
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
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id } }));
  };

  const handleOpenTopic = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-topic-modal', { detail: { id } }));
  };

  const handleOpenFile = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
  };

  if (!isOpen) return null;

  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[720px] sm:w-[900px] sm:max-w-none overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Loading...</SheetTitle>
          </SheetHeader>
          <div className="py-6 text-center text-muted-foreground">Loading session details...</div>
        </SheetContent>
      </Sheet>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog } = data;
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;

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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[720px] sm:w-[900px] sm:max-w-none overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sessionTitle}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Session Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Session Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="font-medium text-muted-foreground">Day:</div>
              <div>{session.start_at ? formatSessionDate(session.start_at) : '—'}</div>
              
              <div className="font-medium text-muted-foreground">Time:</div>
              <div>
                {session.class?.start_time && session.class?.end_time
                  ? `${session.class.start_time} - ${session.class.end_time}`
                  : '—'}
              </div>
              
              <div className="font-medium text-muted-foreground">Subject:</div>
              <div>
                {session.class?.subject
                  ? `${session.class.subject.curriculum || ''} ${session.class.subject.year_level ? `Year ${session.class.subject.year_level}` : ''} ${session.class.subject.name || ''}`.trim()
                  : '—'}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Students Section */}
          <div>
            <div className="font-medium mb-2 text-lg">Students</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Planned Attendance</TableHead>
                  <TableHead>Actual Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No students planned
                    </TableCell>
                  </TableRow>
                ) : (
                  studentsData.map((data: any) => (
                    <TableRow key={data.student.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent('open-student-modal', { detail: { id: data.student.id } })
                            );
                          }}
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Staff Section */}
          <div>
            <div className="font-medium mb-2 text-lg">Staff</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Planned Attendance</TableHead>
                  <TableHead>Actual Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No staff planned
                    </TableCell>
                  </TableRow>
                ) : (
                  staffData.map((data: any) => (
                    <TableRow key={data.staff.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => handleOpenStaff(data.staff.id)}
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Topics Section */}
          {hasTutorLog && tutorLog.topics && tutorLog.topics.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="font-medium mb-2 text-lg">Topics Covered</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Students</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutorLog.topics.map((topicData: any) => {
                      const topic = topicData.topic;
                      const topicCode = deriveTopicCode(topic, allTopics);
                      const students = topicData.students || [];
                      const files = topicData.files || [];
                      
                      return (
                        <TableRow key={topicData.id}>
                          <TableCell>
                            <button
                              type="button"
                              className="text-blue-600 hover:underline text-left"
                              onClick={() => handleOpenTopic(topic.id)}
                            >
                              {topicCode} {topic.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            {files.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-1">
                                {files.map((fileData: any) => {
                                  const topicFile = fileData.topics_file;
                                  if (!topicFile) return null;
                                  
                                  const fileCode = deriveTopicFileCode(topicFile, topicCode, topicFile.type);
                                  return (
                                    <button
                                      key={fileData.id}
                                      type="button"
                                      className="text-blue-600 hover:underline block text-left"
                                      onClick={() => handleOpenFile(topicFile.id)}
                                    >
                                      {fileCode}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {students.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {students.slice(0, 5).map((student: any) => (
                                  <StudentAvatar key={student.id} student={student} size="sm" />
                                ))}
                                {students.length > 5 && (
                                  <span className="text-xs text-muted-foreground self-center ml-1">
                                    +{students.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
      </SheetContent>
    </Sheet>
  );
}
