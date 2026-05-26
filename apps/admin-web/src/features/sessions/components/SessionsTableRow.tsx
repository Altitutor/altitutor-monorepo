'use client';

import React from 'react';
import {
  TableCell,
  TableRow,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from '@altitutor/ui';
import { Check, X, MoreVertical, ExternalLink, Copy, Calendar, CreditCard, RotateCcw, Trash2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { TutorLogAvatar } from './TutorLogAvatar';
import { AttendanceCell } from './AttendanceCell';
import { getInvoiceStatusBadge } from '@/features/billing/utils/invoiceFormatters';
import { getStudentAttendanceStatus, getStaffAttendanceStatus } from '../utils/sessionsTableAttendance';
import { getShortSessionName } from '../utils/session-helpers';
import { openAdminInvoiceModal } from '../utils/openAdminInvoiceModal';
import { SessionTableClassColumn } from './SessionTableClassColumn';
import type { SessionTableStudent, SessionTableStaff } from '../types/sessions-table';
import type { UseSessionsTableModalsReturn } from '../hooks/useSessionsTableModals';
import { useInvoiceSessionMutation } from '../hooks/useInvoiceSessionMutation';
import { STUDENT_PLANNED_STATUSES } from '../constants/attendanceStatuses';
import type { StudentPlannedStatus } from '../constants/attendanceStatuses';

type TutorLogMap = Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;

function studentHasLoggedAbsence(planned: StudentPlannedStatus | undefined): boolean {
  if (!planned) return false;
  return (
    planned === STUDENT_PLANNED_STATUSES.ABSENT ||
    planned === STUDENT_PLANNED_STATUSES.RESCHEDULED ||
    planned === STUDENT_PLANNED_STATUSES.CREDITED
  );
}

export interface SessionsTableRowProps {
  session: Tables<'sessions'>;
  visibleColumns: string[];
  classId?: string;
  hideClassColumn?: boolean;
  hideTypeColumn?: boolean;
  hideStudentsColumn?: boolean;
  hideBilling?: boolean;
  isStudentAttendanceView: boolean;
  isStaffAttendanceView: boolean;
  studentId?: string;
  staffId?: string;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  sessionStudents: Record<string, Tables<'students'>[]>;
  sessionStaff: Record<string, Tables<'staff'>[]>;
  tutorLogs: TutorLogMap;
  allSessions: Tables<'sessions'>[];
  formatDate: (dateString: string) => string;
  getTimeRange: (session: Tables<'sessions'>) => string;
  getClassDisplayName: (session: Tables<'sessions'>) => string;
  getClassShortDisplayName: (session: Tables<'sessions'>) => string;
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
  onUndoLogAbsenceStudent?: (payload: {
    studentId: string;
    studentName: string;
    sessionsStudentsId: string;
    action: 'credit' | 'reschedule';
    rescheduledSessionTitle?: string;
    sessionShortName: string;
  }) => void;
  onUndoLogAbsenceStaff?: (payload: {
    staffId: string;
    staffName: string;
    sessionsStaffId: string;
    action: 'log' | 'swap';
    swappedStaffName?: string;
    sessionShortName: string;
  }) => void;
  onRemoveStudentFromSession?: (sessionId: string, studentId: string, studentName: string, sessionShortName?: string) => void;
  onRemoveStaffFromSession?: (sessionId: string, staffId: string, staffName: string, sessionShortName?: string) => void;
  modals: UseSessionsTableModalsReturn;
  currentStaff: { id: string } | null | undefined;
  onSessionClick: (id: string) => void;
  onClassClick: (classId: string, e: React.MouseEvent) => void;
  onCopySessionId: (id: string, displayText: string) => Promise<void>;
  router: { push: (path: string) => void };
  /** Set of sessions_students IDs that are uninvoiced per reconciliation view (student view only) */
  uninvoicedSessionsStudentsIds?: Set<string>;
}

export function SessionsTableRow({
  session,
  visibleColumns,
  classId,
  hideClassColumn,
  hideTypeColumn,
  hideStudentsColumn,
  hideBilling,
  isStudentAttendanceView,
  isStaffAttendanceView,
  studentId,
  staffId,
  classesById,
  subjectsById,
  sessionStudents,
  sessionStaff,
  tutorLogs,
  allSessions,
  formatDate,
  getTimeRange,
  getClassDisplayName: _getClassDisplayName,
  getClassShortDisplayName,
  onOpenSession,
  onOpenStudent,
  onOpenStaff,
  onUndoLogAbsenceStudent,
  onUndoLogAbsenceStaff,
  onRemoveStudentFromSession,
  onRemoveStaffFromSession,
  modals,
  currentStaff,
  onSessionClick,
  onClassClick,
  onCopySessionId,
  router,
  uninvoicedSessionsStudentsIds,
}: SessionsTableRowProps) {
  const { toast } = useToast();
  const invoiceSessionMutation = useInvoiceSessionMutation();
  const staffList = (sessionStaff[session.id] || []) as SessionTableStaff[];
  const studentList = (sessionStudents[session.id] || []) as SessionTableStudent[];
  const hasTutorLog = !!tutorLogs[session.id];
  const sessionShortName = getShortSessionName({
    ...session,
    class: session.class_id ? classesById[session.class_id] : undefined,
  });

  const showClass = visibleColumns.includes('class') && !classId && !hideClassColumn && !hideTypeColumn;
  const showStaff = visibleColumns.includes('staff') && !isStudentAttendanceView && !isStaffAttendanceView;
  const showStudents = visibleColumns.includes('students') && !hideStudentsColumn && !isStudentAttendanceView && !isStaffAttendanceView;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSessionClick(session.id)}
    >
      {visibleColumns.includes('date') && (
        <TableCell>
          <div className="flex items-center gap-2">
            <span>{session.start_at ? formatDate(session.start_at) : '-'}</span>
            {session.status === 'INACTIVE' && (
              <Badge variant="secondary" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
        </TableCell>
      )}
      {visibleColumns.includes('time') && (
        <TableCell className="font-medium">{getTimeRange(session)}</TableCell>
      )}
      {showClass && (
        <TableCell className="min-w-0 max-w-[14rem]">
          <SessionTableClassColumn
            session={session}
            classesById={classesById}
            subjectsById={subjectsById}
            onClassClick={onClassClick}
          />
        </TableCell>
      )}
      {showStaff && (
        <TableCell>
          {!staffList.length ? (
            <span className="text-muted-foreground text-sm">-</span>
          ) : (
            <div className="flex flex-col gap-1">
              {staffList.map((s) => {
                const planned_absence = s.planned_absence === true;
                const nameClass = planned_absence ? 'text-muted-foreground line-through' : '';
                return (
                  <div key={s.id} className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="link"
                      size="sm"
                      className={cn('h-auto p-0 text-xs justify-start', nameClass)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStaff?.(s.id);
                      }}
                    >
                      {s.first_name} {s.last_name}
                    </Button>
                    {s.actual_attended !== null &&
                      (s.actual_attended ? (
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </TableCell>
      )}
      {showStudents && (
        <TableCell>
          {!studentList.length ? (
            <span className="text-muted-foreground text-sm">-</span>
          ) : (
            <div className="flex flex-col gap-1">
              {studentList.map((s) => {
                const planned_absence = s.planned_absence === true;
                const invoicePayload = s.invoice_status_payload;
                const isExtra = s.is_extra === true;
                const nameClass = planned_absence
                  ? 'text-muted-foreground line-through'
                  : isExtra
                    ? 'text-orange-600 dark:text-orange-400'
                    : '';
                const badge = getInvoiceStatusBadge(invoicePayload, { onOpenInvoice: openAdminInvoiceModal });
                return (
                  <div key={s.id} className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="link"
                      size="sm"
                      className={cn('h-auto p-0 text-xs justify-start', nameClass)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudent?.(s.id);
                      }}
                    >
                      {s.first_name} {s.last_name}
                    </Button>
                    {s.actual_attended !== null &&
                      (s.actual_attended ? (
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                      ))}
                    {!hideBilling && badge}
                  </div>
                );
              })}
            </div>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('planned_attendance') && (
        <TableCell>
          {isStudentAttendanceView ? (
            (() => {
              const selectedStudent = studentList.find((s) => s.id === studentId) || studentList[0];
              if (!selectedStudent) return <span className="text-muted-foreground text-sm">-</span>;
              const plannedStudentIds = new Set(
                studentList
                  .filter((s) => s.sessions_students_id != null)
                  .map((s) => s.id)
              );
              const attendance = getStudentAttendanceStatus(selectedStudent, hasTutorLog, plannedStudentIds);
              return (
                <AttendanceCell
                  status={attendance.plannedStatus}
                  linkTo={
                    attendance.plannedStatus === 'rescheduled' && attendance.rescheduledSessionId
                      ? {
                          type: 'session',
                          id: attendance.rescheduledSessionId,
                          onClick: () => onOpenSession?.(attendance.rescheduledSessionId),
                        }
                      : undefined
                  }
                  linkText={
                    attendance.plannedStatus === 'rescheduled'
                      ? attendance.rescheduledDate
                      : attendance.plannedStatus === 'credited' && attendance.creditedDisplayDate
                        ? attendance.creditedDisplayDate
                        : undefined
                  }
                />
              );
            })()
          ) : isStaffAttendanceView ? (
            (() => {
              const selectedStaff = staffList.find((s) => s.id === staffId) || staffList[0];
              if (!selectedStaff) return <span className="text-muted-foreground text-sm">-</span>;
              const attendance = getStaffAttendanceStatus(selectedStaff, hasTutorLog);
              return (
                <AttendanceCell
                  status={attendance.plannedStatus}
                  linkTo={
                    attendance.plannedStatus === 'swapped' && attendance.swappedStaffId
                      ? {
                          type: 'staff',
                          id: attendance.swappedStaffId,
                          onClick: () => onOpenStaff?.(attendance.swappedStaffId),
                        }
                      : undefined
                  }
                  linkText={attendance.swappedStaffName}
                />
              );
            })()
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('actual_attendance') && (
        <TableCell>
          {isStudentAttendanceView ? (
            (() => {
              const selectedStudent = studentList.find((s) => s.id === studentId) || studentList[0];
              if (!selectedStudent) return <span className="text-muted-foreground text-sm">-</span>;
              const plannedStudentIds = new Set(
                studentList
                  .filter((s) => s.sessions_students_id != null)
                  .map((s) => s.id)
              );
              const attendance = getStudentAttendanceStatus(selectedStudent, hasTutorLog, plannedStudentIds);
              return <AttendanceCell status={attendance.actualStatus} />;
            })()
          ) : isStaffAttendanceView ? (
            (() => {
              const selectedStaff = staffList.find((s) => s.id === staffId) || staffList[0];
              if (!selectedStaff) return <span className="text-muted-foreground text-sm">-</span>;
              const attendance = getStaffAttendanceStatus(selectedStaff, hasTutorLog);
              return <AttendanceCell status={attendance.actualStatus} staffType={selectedStaff.actual_type ?? undefined} />;
            })()
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('invoice') && (
        <TableCell>
          {(() => {
            const selectedStudent = studentList.find((s) => s.id === studentId) || studentList[0];
            const invoicePayload = selectedStudent?.invoice_status_payload ?? null;
            if (invoicePayload) {
              const badge = getInvoiceStatusBadge(invoicePayload, { onOpenInvoice: openAdminInvoiceModal });
              if (!badge) return <span className="text-xs text-muted-foreground">-</span>;
              return badge;
            }
            const sessionsStudentsId = selectedStudent?.sessions_students_id;
            const isUninvoiced =
              isStudentAttendanceView &&
              sessionsStudentsId &&
              uninvoicedSessionsStudentsIds?.has(sessionsStudentsId);
            if (isUninvoiced) {
              return (
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    invoiceSessionMutation.mutate(sessionsStudentsId!);
                  }}
                  disabled={invoiceSessionMutation.isPending}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  {invoiceSessionMutation.isPending ? 'Invoicing...' : 'Send invoice'}
                </Button>
              );
            }
            return <span className="text-xs text-muted-foreground">-</span>;
          })()}
        </TableCell>
      )}
      {visibleColumns.includes('tutor_log') && (
        <TableCell>
          {tutorLogs[session.id] ? (
            <TutorLogAvatar
              firstName={tutorLogs[session.id].created_by_name.first_name}
              lastName={tutorLogs[session.id].created_by_name.last_name}
            />
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
      )}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {isStudentAttendanceView ? (
          <SessionsTableRowStudentActions
            session={session}
            studentList={studentList}
            studentId={studentId}
            hasTutorLog={hasTutorLog}
            classesById={classesById}
            allSessions={allSessions}
            sessionShortName={sessionShortName}
            getClassShortDisplayName={getClassShortDisplayName}
            getShortSessionName={getShortSessionName}
            onOpenSession={onOpenSession}
            onUndoLogAbsenceStudent={onUndoLogAbsenceStudent}
            onRemoveStudentFromSession={onRemoveStudentFromSession}
            modals={modals}
            currentStaff={currentStaff}
            onCopySessionId={onCopySessionId}
            router={router}
            toast={toast}
          />
        ) : (
          <SessionsTableRowDefaultActions
            session={session}
            staffList={staffList}
            staffId={staffId}
            hasTutorLog={hasTutorLog}
            tutorLogs={tutorLogs}
            classesById={classesById}
            sessionShortName={sessionShortName}
            getClassShortDisplayName={getClassShortDisplayName}
            onOpenStaff={onOpenStaff}
            onUndoLogAbsenceStaff={onUndoLogAbsenceStaff}
            onRemoveStaffFromSession={onRemoveStaffFromSession}
            modals={modals}
            onCopySessionId={onCopySessionId}
            router={router}
            toast={toast}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

// --- Student attendance view: dropdown actions ---
interface SessionsTableRowStudentActionsProps {
  session: Tables<'sessions'>;
  studentList: SessionTableStudent[];
  studentId?: string;
  hasTutorLog: boolean;
  classesById: Record<string, Tables<'classes'>>;
  allSessions: Tables<'sessions'>[];
  sessionShortName: string;
  getClassShortDisplayName: (session: Tables<'sessions'>) => string;
  getShortSessionName: (session: Parameters<typeof getShortSessionName>[0]) => string;
  onOpenSession?: (id: string) => void;
  onUndoLogAbsenceStudent?: (payload: {
    studentId: string;
    studentName: string;
    sessionsStudentsId: string;
    action: 'credit' | 'reschedule';
    rescheduledSessionTitle?: string;
    sessionShortName: string;
  }) => void;
  onRemoveStudentFromSession?: (sessionId: string, studentId: string, studentName: string, sessionShortName?: string) => void;
  modals: UseSessionsTableModalsReturn;
  currentStaff: { id: string } | null | undefined;
  onCopySessionId: (id: string, displayText: string) => Promise<void>;
  router: { push: (path: string) => void };
  toast: ReturnType<typeof useToast>['toast'];
}

function SessionsTableRowStudentActions({
  session,
  studentList,
  studentId,
  hasTutorLog,
  classesById,
  allSessions,
  sessionShortName,
  getClassShortDisplayName,
  getShortSessionName,
  onOpenSession: _onOpenSession,
  onUndoLogAbsenceStudent,
  onRemoveStudentFromSession,
  modals,
  currentStaff,
  onCopySessionId,
  router,
  toast,
}: SessionsTableRowStudentActionsProps) {
  const selectedStudent = studentList.find((s) => s.id === studentId) || studentList[0];
  const plannedStudentIds = new Set(studentList.filter((s) => s.sessions_students_id != null).map((s) => s.id));
  const attendance = selectedStudent
    ? getStudentAttendanceStatus(selectedStudent, hasTutorLog, plannedStudentIds)
    : null;
  const canLogAbsence = !!selectedStudent && !selectedStudent.invoice_status_payload;
  const canOpenAbsenceDialog = !!currentStaff && !!studentId;
  const loggedStudentAbsence = studentHasLoggedAbsence(attendance?.plannedStatus);
  const canUndoStudent =
    onUndoLogAbsenceStudent &&
    selectedStudent?.sessions_students_id &&
    (attendance?.plannedStatus === 'credited' || attendance?.plannedStatus === 'rescheduled');
  const rescheduledSession =
    selectedStudent?.rescheduled_session?.session?.id &&
    allSessions.find((s) => s.id === selectedStudent.rescheduled_session?.session?.id);
  const rescheduledSessionTitle = rescheduledSession
    ? getShortSessionName({
        ...rescheduledSession,
        class: rescheduledSession.class_id ? classesById[rescheduledSession.class_id] : undefined,
      })
    : undefined;
  const canRemoveStudent =
    !hasTutorLog &&
    !selectedStudent?.invoice_status_payload &&
    (attendance?.plannedStatus === 'attending-extra' || attendance?.plannedStatus === 'attending-extra-trial') &&
    !!onRemoveStudentFromSession &&
    !!selectedStudent;
  const logAbsenceReason = hasTutorLog
    ? 'Session already has a tutor log.'
    : selectedStudent?.invoice_status_payload
      ? 'Student has an invoice item for this session.'
      : !canLogAbsence
        ? 'No absence to log for this student.'
        : '';
  const undoReason =
    canUndoStudent && selectedStudent && attendance
      ? ''
      : !selectedStudent?.sessions_students_id
        ? 'Student enrollment data is missing for this session.'
        : attendance?.plannedStatus === STUDENT_PLANNED_STATUSES.ABSENT
          ? 'Only credited or rescheduled absences can be undone.'
          : 'This absence cannot be undone.';
  const removeStudentReason = canRemoveStudent
    ? ''
    : hasTutorLog
      ? 'Session has a tutor log; cannot remove student.'
      : selectedStudent?.invoice_status_payload
        ? 'Student has an invoice item for this session.'
        : attendance?.plannedStatus !== 'attending-extra' && attendance?.plannedStatus !== 'attending-extra-trial'
          ? 'Only extra or trial students can be removed from a session.'
          : 'Cannot remove this student from the session.';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/sessions/${session.id}`)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in page
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await onCopySessionId(session.id, getClassShortDisplayName(session) || session.id);
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy ID
        </DropdownMenuItem>
        {!loggedStudentAbsence && (
          <DropdownMenuItem
            className={cn((!canLogAbsence || !canOpenAbsenceDialog) && 'opacity-60 text-muted-foreground')}
            onClick={(e) => {
              e.stopPropagation();
              if (canLogAbsence && canOpenAbsenceDialog) {
                modals.openLogAbsenceDialog(session.id);
              } else {
                toast({ description: logAbsenceReason || 'Cannot log absence.', variant: 'destructive' });
              }
            }}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Log student absence
          </DropdownMenuItem>
        )}
        {onUndoLogAbsenceStudent && loggedStudentAbsence && (
          <DropdownMenuItem
            className={cn(!(canUndoStudent && selectedStudent && attendance) && 'opacity-60 text-muted-foreground')}
            onClick={(e) => {
              e.stopPropagation();
              if (canUndoStudent && selectedStudent && attendance) {
                const studentName = `${selectedStudent.first_name ?? ''} ${selectedStudent.last_name ?? ''}`.trim() || 'Student';
                onUndoLogAbsenceStudent({
                  studentId: selectedStudent.id,
                  studentName,
                  sessionsStudentsId: selectedStudent.sessions_students_id!,
                  action: attendance.plannedStatus === 'rescheduled' ? 'reschedule' : 'credit',
                  rescheduledSessionTitle,
                  sessionShortName,
                });
              } else {
                toast({ description: undoReason, variant: 'destructive' });
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Undo log absence
          </DropdownMenuItem>
        )}
        {onRemoveStudentFromSession && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn(
                !canRemoveStudent && 'opacity-60 text-muted-foreground',
                canRemoveStudent &&
                  '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10'
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (canRemoveStudent && selectedStudent) {
                  const studentName = `${selectedStudent.first_name ?? ''} ${selectedStudent.last_name ?? ''}`.trim() || 'Student';
                  onRemoveStudentFromSession(session.id, selectedStudent.id, studentName, sessionShortName);
                } else {
                  toast({ description: removeStudentReason, variant: 'destructive' });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from session
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Default view: dropdown actions (log session, edit tutor log, reschedule, remove staff) ---
interface SessionsTableRowDefaultActionsProps {
  session: Tables<'sessions'>;
  staffList: SessionTableStaff[];
  staffId?: string;
  hasTutorLog: boolean;
  tutorLogs: TutorLogMap;
  classesById: Record<string, Tables<'classes'>>;
  sessionShortName: string;
  getClassShortDisplayName: (session: Tables<'sessions'>) => string;
  onOpenStaff?: (id: string) => void;
  onUndoLogAbsenceStaff?: (payload: {
    staffId: string;
    staffName: string;
    sessionsStaffId: string;
    action: 'log' | 'swap';
    swappedStaffName?: string;
    sessionShortName: string;
  }) => void;
  onRemoveStaffFromSession?: (sessionId: string, staffId: string, staffName: string, sessionShortName?: string) => void;
  modals: UseSessionsTableModalsReturn;
  onCopySessionId: (id: string, displayText: string) => Promise<void>;
  router: { push: (path: string) => void };
  toast: ReturnType<typeof useToast>['toast'];
}

function SessionsTableRowDefaultActions({
  session,
  staffList,
  staffId,
  hasTutorLog,
  tutorLogs,
  sessionShortName,
  getClassShortDisplayName,
  onUndoLogAbsenceStaff,
  onRemoveStaffFromSession,
  modals,
  onCopySessionId,
  router,
  toast,
}: SessionsTableRowDefaultActionsProps) {
  const selectedStaff = staffList.find((s) => s.id === staffId) || staffList[0];
  const staffAttendance = selectedStaff ? getStaffAttendanceStatus(selectedStaff, hasTutorLog) : null;
  const canUndoStaff =
    onUndoLogAbsenceStaff &&
    selectedStaff?.sessions_staff_id &&
    (staffAttendance?.plannedStatus === 'absent' || staffAttendance?.plannedStatus === 'swapped');
  const canRemoveStaff = !hasTutorLog && !!onRemoveStaffFromSession && !!selectedStaff;
  const undoStaffReason = canUndoStaff && selectedStaff && staffAttendance ? '' : 'No logged absence to undo for this staff.';
  const removeStaffReason = canRemoveStaff
    ? ''
    : hasTutorLog
      ? 'Session has a tutor log; cannot remove staff.'
      : 'Cannot remove this staff from the session.';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onUndoLogAbsenceStaff && (
          <>
            <DropdownMenuItem
              className={cn(!(canUndoStaff && selectedStaff && staffAttendance) && 'opacity-60 text-muted-foreground')}
              onClick={(e) => {
                e.stopPropagation();
                if (canUndoStaff && selectedStaff && staffAttendance) {
                  const staffName = `${selectedStaff.first_name ?? ''} ${selectedStaff.last_name ?? ''}`.trim() || 'Staff';
                  onUndoLogAbsenceStaff({
                    staffId: selectedStaff.id,
                    staffName,
                    sessionsStaffId: selectedStaff.sessions_staff_id!,
                    action: staffAttendance.plannedStatus === 'swapped' ? 'swap' : 'log',
                    swappedStaffName: staffAttendance.swappedStaffName || undefined,
                    sessionShortName,
                  });
                } else {
                  toast({ description: undoStaffReason, variant: 'destructive' });
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Undo log absence
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => router.push(`/sessions/${session.id}`)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in page
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await onCopySessionId(session.id, getClassShortDisplayName(session) || session.id);
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy ID
        </DropdownMenuItem>
        {hasTutorLog && tutorLogs[session.id] ? (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              modals.openEditTutorLogModal(tutorLogs[session.id].id);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Edit tutor log
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              modals.openLogSessionModal(session.id, session.type);
            }}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Log session
          </DropdownMenuItem>
        )}
        {onRemoveStaffFromSession && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn(
                !canRemoveStaff && 'opacity-60 text-muted-foreground',
                canRemoveStaff &&
                  '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10'
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (canRemoveStaff && selectedStaff) {
                  const staffName = `${selectedStaff.first_name ?? ''} ${selectedStaff.last_name ?? ''}`.trim() || 'Staff';
                  onRemoveStaffFromSession(session.id, selectedStaff.id, staffName, sessionShortName);
                } else {
                  toast({ description: removeStaffReason, variant: 'destructive' });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from session
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
