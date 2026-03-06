'use client';

import { useEffect, useRef } from 'react';
import { Badge, Separator, Button, Input, Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { MoreVertical, MessageSquare, AlertTriangle, RotateCcw, Trash2, Pencil } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatSessionDate } from '../utils/session-helpers';
import { formatSessionTimeRangeForDisplay, type SessionTimeInput } from '@altitutor/shared';
import { Supabase } from '@altitutor/shared';
import { AttendanceCell } from './AttendanceCell';
import { StudentAvatar } from './StudentAvatar';
import { TutorLogAvatar } from './TutorLogAvatar';
import { formatSubjectDisplay, getSubjectColorStyle, formatClassName, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import {
  SessionInfoGrid,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { SessionDetailsSession, SessionDetailsTutorLog } from '../types';
import { useSubjects } from '@/features/subjects';
import { useClassesMinimal } from '@/features/classes/hooks/useClassesQuery';

const SESSION_TYPES = Supabase.Constants.public.Enums.session_type;

const sessionEditSchema = z
  .object({
    type: z.enum([...SESSION_TYPES] as [string, ...string[]]),
    startAtLocal: z.string().min(1, 'Start date/time is required'),
    endAtLocal: z.string().min(1, 'End date/time is required'),
    subjectId: z.string().optional().nullable(),
    classId: z.string().optional().nullable(),
  })
  .refine((data) => data.endAtLocal > data.startAtLocal, {
    message: 'End must be after start',
    path: ['endAtLocal'],
  });

export type SessionEditFormData = z.infer<typeof sessionEditSchema>;

/** Convert ISO string to datetime-local value (YYYY-MM-DDTHH:mm) */
function toLocalDateTimeString(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

type SessionDetailsTabProps = {
  session: SessionDetailsSession | null;
  tutorLog: SessionDetailsTutorLog | null;
  studentsData: Array<{
    student: Tables<'students'>;
    sessionsStudentsId: string | null;
    rescheduledSessionsStudentsId: string | null;
    plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned';
    actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend';
    rescheduledDate: string;
    rescheduledSessionId?: string;
    invoiceStatus: string | null;
    plannedAbsence: boolean;
    hasInvoiceItems: boolean;
  }>;
  staffData: Array<{
    staff: Tables<'staff'>;
    sessionsStaffId: string | null;
    swappedSessionsStaffId: string | null;
    plannedStatus: 'attending' | 'attending-trial' | 'absent' | 'swapped';
    actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend';
    staffType?: string;
    swappedStaffName: string;
    swappedStaffId: string;
    submittedTutorLog: boolean;
    plannedAbsence: boolean;
  }>;
  allTopics: Tables<'topics'>[];
  sessionId: string | null;
  isSessionInPast: boolean;
  currentStaff: Tables<'staff'> | null;
  onOpenSession: (sessionId: string) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenStaff: (staffId: string) => void;
  onOpenClass: (classId: string) => void;
  onMessageStudent: (studentId: string) => void;
  onMessageStaff: (staffId: string) => void;
  onOpenTopic: (topicId: string) => void;
  onOpenFile: (fileId: string) => void;
  onLogAbsenceStudent?: (studentId: string) => void;
  onLogAbsenceStaff?: (staffId: string) => void;
  onUndoLogAbsenceStudent?: (payload: {
    studentId: string;
    studentName: string;
    sessionsStudentsId: string;
    action: 'credit' | 'reschedule';
    rescheduledSessionId?: string;
  }) => void;
  onUndoLogAbsenceStaff?: (payload: {
    staffId: string;
    staffName: string;
    sessionsStaffId: string;
    action: 'log' | 'swap';
    swappedStaffName?: string;
  }) => void;
  onLogSession?: () => void;
  onAddStudentToSession?: () => void;
  onAddStaffToSession?: () => void;
  onRemoveStudentFromSession?: (studentId: string, studentName: string) => void;
  onRemoveStaffFromSession?: (staffId: string, staffName: string) => void;
  /** Edit mode: when true, show edit form instead of view */
  isEditing?: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmit?: (data: SessionEditFormData) => Promise<void>;
  isUpdating?: boolean;
};

export function SessionDetailsTab({
  session,
  studentsData,
  staffData,
  tutorLog,
  allTopics,
  sessionId,
  isSessionInPast: _isSessionInPast,
  currentStaff: _currentStaff,
  onOpenSession,
  onOpenStudent,
  onOpenStaff,
  onOpenClass,
  onMessageStudent,
  onMessageStaff,
  onOpenTopic,
  onOpenFile,
  onLogAbsenceStudent,
  onLogAbsenceStaff,
  onUndoLogAbsenceStudent,
  onUndoLogAbsenceStaff,
  onLogSession: _onLogSession,
  onAddStudentToSession,
  onAddStaffToSession,
  onRemoveStudentFromSession,
  onRemoveStaffFromSession,
  isEditing = false,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
  isUpdating = false,
}: SessionDetailsTabProps) {
  const { toast } = useToast();
  const hasTutorLog = !!tutorLog;
  const subject = session?.subject ?? session?.class?.subject;
  const classData = session?.class;
  const classId = session?.class_id ?? null;

  const { data: subjects = [] } = useSubjects();
  const { data: classesData } = useClassesMinimal(
    isEditing ? { limit: 300 } : undefined
  );
  const classesList = classesData?.classes ?? [];

  const form = useForm<SessionEditFormData>({
    resolver: zodResolver(sessionEditSchema),
    defaultValues: {
      type: 'CLASS',
      startAtLocal: '',
      endAtLocal: '',
      subjectId: null,
      classId: null,
    },
  });
  const formType = form.watch('type');
  const hasResetRef = useRef(false);

  useEffect(() => {
    if (formType !== 'CLASS') {
      form.setValue('subjectId', null, { shouldValidate: false });
      form.setValue('classId', null, { shouldValidate: false });
    }
  }, [formType, form]);

  useEffect(() => {
    if (isEditing && session && !hasResetRef.current) {
      const type = (session.type ?? 'CLASS') as SessionEditFormData['type'];
      form.reset({
        type,
        startAtLocal: toLocalDateTimeString(session.start_at ?? null),
        endAtLocal: toLocalDateTimeString(session.end_at ?? null),
        subjectId: session.subject?.id ?? session.class?.subject?.id ?? session.subject_id ?? null,
        classId: session.class_id ?? null,
      }, { keepDefaultValues: false });
      hasResetRef.current = true;
    } else if (!isEditing) {
      hasResetRef.current = false;
    }
    // session refs above are sufficient; including full session would reset form on every session field change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, session?.id, session?.start_at, session?.end_at, session?.type, session?.subject_id, session?.class_id, session?.subject?.id, session?.class?.subject?.id, form]);

  const classesForSubject = formType === 'CLASS' && form.watch('subjectId')
    ? classesList.filter((c) => c.subject_id === form.watch('subjectId'))
    : classesList;

  if (!session) return null;

  return (
    <div className="space-y-6">
      {/* Session Information */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit Session' : 'Session Information'}
          </h3>
          {!isEditing && onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <form
            id="session-edit-form"
            onSubmit={form.handleSubmit(async (data) => {
              if (!onSubmit) return;
              await onSubmit(data);
            })}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="session-type">Type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger id="session-type">
                      <SelectValue placeholder="Session type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {formatSessionType(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="session-start">Start</Label>
                <Controller
                  control={form.control}
                  name="startAtLocal"
                  render={({ field }) => (
                    <Input
                      id="session-start"
                      type="datetime-local"
                      {...field}
                      disabled={isUpdating}
                    />
                  )}
                />
                {form.formState.errors.startAtLocal && (
                  <p className="text-sm text-destructive mt-0.5">{form.formState.errors.startAtLocal.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="session-end">End</Label>
                <Controller
                  control={form.control}
                  name="endAtLocal"
                  render={({ field }) => (
                    <Input
                      id="session-end"
                      type="datetime-local"
                      {...field}
                      disabled={isUpdating}
                    />
                  )}
                />
                {form.formState.errors.endAtLocal && (
                  <p className="text-sm text-destructive mt-0.5">{form.formState.errors.endAtLocal.message}</p>
                )}
              </div>
            </div>
            {formType === 'CLASS' && (
              <>
                <div>
                  <Label htmlFor="session-subject">Subject</Label>
                  <Controller
                    control={form.control}
                    name="subjectId"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? 'none'}
                        onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger id="session-subject">
                          <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {formatSubjectDisplay(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="session-class">Class</Label>
                  <Controller
                    control={form.control}
                    name="classId"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? 'none'}
                        onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger id="session-class">
                          <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {classesForSubject.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {formatClassName(c as unknown as Tables<'classes'>, c.subject ?? null)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            )}
          </form>
        ) : (
        <SessionInfoGrid
          day={session.start_at ? formatSessionDate(session.start_at) : '—'}
          time={formatSessionTimeRangeForDisplay(session as SessionTimeInput, formatTime)}
          timeSubline={
            session.type ? (
              <Badge variant="secondary" className={getSessionTypeBadgeColor(session.type)}>
                {formatSessionType(session.type)}
              </Badge>
            ) : undefined
          }
          subjectNode={
            session.type === 'CLASS'
              ? subject
                ? (() => {
                    const { style, textColorClass } = getSubjectColorStyle(subject as unknown as Tables<'subjects'>);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge
                        className={defaultClass || textColorClass}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectDisplay(subject as unknown as Tables<'subjects'>)}
                      </Badge>
                    );
                  })()
                : '—'
              : undefined
          }
          classNode={
            session.type === 'CLASS' && classData && classId
              ? (
                  <button
                    type="button"
                    onClick={() => onOpenClass(classId)}
                    className="text-accent-foreground hover:text-accent-foreground/80 hover:underline font-medium text-left"
                  >
                    {formatClassName(classData as unknown as Tables<'classes'>, (subject ?? null) as unknown as Tables<'subjects'> | null)}
                  </button>
                )
              : undefined
          }
        />
        )}
      </div>

      <Separator />

      {/* Students Section */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Students ({studentsData.length})</h3>
          {onAddStudentToSession && (
            <Button size="sm" variant="outline" onClick={onAddStudentToSession}>
              Add student
            </Button>
          )}
        </div>
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
                {studentsData.map((data) => (
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
                                onClick: () => data.rescheduledSessionId && onOpenSession(data.rescheduledSessionId),
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
                            variant="outline"
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
                              onMessageStudent(data.student.id);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {((data.plannedStatus === 'credited' || data.plannedStatus === 'rescheduled') && data.sessionsStudentsId && onUndoLogAbsenceStudent) ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const studentName = `${data.student.first_name || ''} ${data.student.last_name || ''}`.trim();
                                onUndoLogAbsenceStudent({
                                  studentId: data.student.id,
                                  studentName: studentName || 'Student',
                                  sessionsStudentsId: data.sessionsStudentsId!,
                                  action: data.plannedStatus === 'rescheduled' ? 'reschedule' : 'credit',
                                  rescheduledSessionId: data.rescheduledSessionId,
                                });
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Undo Log Absence
                            </DropdownMenuItem>
                          ) : (!data.plannedAbsence && !data.hasInvoiceItems && sessionId && onLogAbsenceStudent) ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onLogAbsenceStudent(data.student.id);
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Log Absence
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className={
                              !(!hasTutorLog && !data.hasInvoiceItems && (data.plannedStatus === 'attending-extra' || data.plannedStatus === 'attending-extra-trial') && onRemoveStudentFromSession)
                                ? 'opacity-60 text-muted-foreground'
                                : '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              const canRemove = !hasTutorLog && !data.hasInvoiceItems && (data.plannedStatus === 'attending-extra' || data.plannedStatus === 'attending-extra-trial') && onRemoveStudentFromSession;
                              if (canRemove) {
                                const studentName = `${data.student.first_name || ''} ${data.student.last_name || ''}`.trim();
                                onRemoveStudentFromSession(data.student.id, studentName || 'Student');
                              } else {
                                toast({
                                  description: hasTutorLog ? 'Session has a tutor log; cannot remove student.' : data.hasInvoiceItems ? 'Student has an invoice item for this session.' : (data.plannedStatus !== 'attending-extra' && data.plannedStatus !== 'attending-extra-trial') ? 'Only extra or trial students can be removed.' : 'Remove from session is not available.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from session
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Staff ({staffData.length})</h3>
          {onAddStaffToSession && (
            <Button size="sm" variant="outline" onClick={onAddStaffToSession}>
              Add staff
            </Button>
          )}
        </div>
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
                {staffData.map((data) => (
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
                      <AttendanceCell status={data.actualStatus} staffType={data.staffType as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | undefined} />
                    </TableCell>
                    <TableCell>
                      {tutorLog && tutorLog.created_by_staff && tutorLog.created_by_staff.first_name && tutorLog.created_by_staff.last_name ? (
                        <TutorLogAvatar
                          firstName={tutorLog.created_by_staff.first_name}
                          lastName={tutorLog.created_by_staff.last_name}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
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
                              onMessageStaff(data.staff.id);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {((data.plannedStatus === 'absent' || data.plannedStatus === 'swapped') && data.sessionsStaffId && onUndoLogAbsenceStaff) ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const staffName = `${data.staff.first_name || ''} ${data.staff.last_name || ''}`.trim();
                                onUndoLogAbsenceStaff({
                                  staffId: data.staff.id,
                                  staffName: staffName || 'Staff',
                                  sessionsStaffId: data.sessionsStaffId!,
                                  action: data.plannedStatus === 'swapped' ? 'swap' : 'log',
                                  swappedStaffName: data.swappedStaffName || undefined,
                                });
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Undo Log Absence
                            </DropdownMenuItem>
                          ) : (!data.plannedAbsence && sessionId && onLogAbsenceStaff) ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onLogAbsenceStaff(data.staff.id);
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Log Absence
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className={
                              !(!hasTutorLog && onRemoveStaffFromSession)
                                ? 'opacity-60 text-muted-foreground'
                                : '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasTutorLog && onRemoveStaffFromSession) {
                                const staffName = `${data.staff.first_name || ''} ${data.staff.last_name || ''}`.trim();
                                onRemoveStaffFromSession(data.staff.id, staffName || 'Staff');
                              } else {
                                toast({
                                  description: hasTutorLog ? 'Session has a tutor log; cannot remove staff.' : 'Remove from session is not available.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from session
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
              {tutorLog.topics.map((topicData) => {
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
                        onClick={() => topic && onOpenTopic(topic.id)}
                      >
                        {topicCode} {topic?.name}
                      </button>
                    </div>
                    
                    {files.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Files:</div>
                        <div className="space-y-1">
                          {files.map((fileData) => {
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
                          {students.slice(0, 5).map((student) => (
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
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            This session has not been logged yet.
          </p>
        </div>
      )}
    </div>
  );
}
