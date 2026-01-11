'use client';

import { Badge, Separator, Button } from '@altitutor/ui';
import { format } from 'date-fns';
import { MoreVertical, Check } from 'lucide-react';
import { formatSessionDate } from '../utils/session-helpers';
import { AttendanceCell } from './AttendanceCell';
import { StudentAvatar } from './StudentAvatar';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
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
import type { Tables } from '@altitutor/shared';

type SessionDetailsTabProps = {
  session: any;
  studentsData: Array<{
    student: Tables<'students'>;
    plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned';
    actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
    rescheduledDate: string;
    rescheduledSessionId?: string;
    invoiceStatus: string | null;
    plannedAbsence: boolean;
    hasInvoiceItems: boolean;
  }>;
  staffData: Array<{
    staff: Tables<'staff'>;
    plannedStatus: 'attending' | 'absent' | 'swapped';
    actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
    staffType?: string;
    swappedStaffName: string;
    swappedStaffId: string;
    submittedTutorLog: boolean;
    plannedAbsence: boolean;
  }>;
  tutorLog: any;
  allTopics: Tables<'topics'>[];
  sessionId: string | null;
  isSessionInPast: boolean;
  currentStaff: Tables<'staff'> | null;
  onOpenSession: (sessionId: string) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenStaff: (staffId: string) => void;
  onMessageStudent: (studentId: string) => void;
  onMessageStaff: (staffId: string) => void;
  onOpenTopic: (topicId: string) => void;
  onOpenFile: (fileId: string) => void;
  onLogAbsenceStudent?: (studentId: string) => void;
  onLogAbsenceStaff?: (staffId: string) => void;
  onSendBookingConfirmation?: (studentId: string) => void;
  onLogSession?: () => void;
};

export function SessionDetailsTab({
  session,
  studentsData,
  staffData,
  tutorLog,
  allTopics,
  sessionId,
  isSessionInPast,
  currentStaff,
  onOpenSession,
  onOpenStudent,
  onOpenStaff,
  onMessageStudent,
  onMessageStaff,
  onOpenTopic,
  onOpenFile,
  onLogAbsenceStudent,
  onLogAbsenceStaff,
  onSendBookingConfirmation,
  onLogSession,
}: SessionDetailsTabProps) {
  const hasTutorLog = !!tutorLog;
  const subject = (session as any).subject || session.class?.subject;

  return (
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
                        onClick={() => onOpenStudent(data.student.id)}
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
                                onClick: () => onOpenSession(data.rescheduledSessionId),
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
                              onOpenStudent(data.student.id);
                            }}
                          >
                            View Student
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onMessageStudent(data.student.id);
                            }}
                          >
                            Message
                          </DropdownMenuItem>
                          {sessionId && session.type !== 'CLASS' && onSendBookingConfirmation && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendBookingConfirmation(data.student.id);
                              }}
                            >
                              Send Booking Confirmation Link
                            </DropdownMenuItem>
                          )}
                          {!data.plannedAbsence && !isSessionInPast && !data.hasInvoiceItems && sessionId && onLogAbsenceStudent && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onLogAbsenceStudent(data.student.id);
                              }}
                            >
                              Log Absence
                            </DropdownMenuItem>
                          )}
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
                        onClick={() => onOpenStaff(data.staff.id)}
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
                                onClick: () => onOpenStaff(data.swappedStaffId),
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
                              onOpenStaff(data.staff.id);
                            }}
                          >
                            View Staff
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onMessageStaff(data.staff.id);
                            }}
                          >
                            Message
                          </DropdownMenuItem>
                          {!data.plannedAbsence && !isSessionInPast && sessionId && onLogAbsenceStaff && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onLogAbsenceStaff(data.staff.id);
                              }}
                            >
                              Log Absence
                            </DropdownMenuItem>
                          )}
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
                        onClick={() => onOpenTopic(topic.id)}
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
                                onClick={() => fileId && onOpenFile(fileId)}
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
                              onClick={() => onOpenStudent(student.id)}
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
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            This session has not been logged yet.
          </p>
          {sessionId && currentStaff && onLogSession && (
            <Button
              onClick={onLogSession}
            >
              Log Session
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
