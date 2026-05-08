'use client';

import { useMemo } from 'react';
import { Button, Checkbox, Input } from '@altitutor/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { X, Search, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useStudentAttendance, type StudentAttendanceItem } from '../../hooks/useStudentAttendance';
import { MeetingEntitySearchAdd } from '@/features/sessions/components/MeetingEntitySearchAdd';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { processSessionStudents } from '@/features/sessions/utils/sessionDataProcessing';
import {
  buildSessionStudentItemsForTutorLog,
  TUTOR_LOG_DRAFT_SESSIONS_STUDENTS_ID,
} from '../../utils/logSessionAttendanceRows';

export type ParentAttendanceItem = { parentId: string; attended: boolean };

type Step3StudentAttendanceProps = {
  title?: string;
  sessionId: string;
  sessionType?: string | null;
  sessionParents?: Array<Tables<'parents'> & { sessions_parents_id?: string }>;
  studentAttendance: StudentAttendanceItem[];
  parentAttendance?: ParentAttendanceItem[];
  onUpdate: (studentAttendance: StudentAttendanceItem[]) => void;
  onParentAttendanceUpdate?: (parentAttendance: ParentAttendanceItem[]) => void;
  addStudentVariant?: 'legacy' | 'search';
  onAddStudentToSession?: (studentId: string) => Promise<void>;
  onAddParentToSession?: (parentId: string) => Promise<void>;
  /** Default `both`: student + parent blocks. Use split sections in meeting combined step. */
  section?: 'both' | 'students' | 'parents';
};

export function Step3StudentAttendance({
  title,
  sessionId,
  sessionType,
  sessionParents = [],
  studentAttendance,
  parentAttendance = [],
  onUpdate,
  onParentAttendanceUpdate,
  addStudentVariant = 'legacy',
  onAddStudentToSession,
  onAddParentToSession,
  section = 'both',
}: Step3StudentAttendanceProps) {
  const queryClient = useQueryClient();
  const {
    sessionData,
    allStudents,
    filteredStudents,
    isLoading,
    showSearch,
    searchTerm,
    setShowSearch,
    setSearchTerm,
    handleAttendanceChange,
    handleAddStudent,
    handleRemoveStudent,
    getStudentAttendance,
  } = useStudentAttendance({
    sessionId,
    studentAttendance,
    onUpdate,
  });

  const allowAbsenceLogging = Boolean(
    sessionData?.session?.class_id || sessionData?.session?.admin_shift_id
  );

  const studentSessionItems = useMemo(
    () =>
      sessionData?.students?.length != null
        ? buildSessionStudentItemsForTutorLog(
            sessionData.students,
            studentAttendance,
            allStudents
          )
        : [],
    [sessionData?.students, studentAttendance, allStudents]
  );

  const actualStudentMap = useMemo(() => {
    const m: Record<string, { attended: boolean; was_trial?: boolean }> = {};
    for (const a of studentAttendance) {
      m[a.studentId] = { attended: a.attended };
    }
    return m;
  }, [studentAttendance]);

  const studentsProcessed = useMemo(
    () => processSessionStudents(studentSessionItems, actualStudentMap, true),
    [studentSessionItems, actualStudentMap]
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const showStudentsBlock = section === 'both' || section === 'students';
  const showParentsBlock = section === 'both' || section === 'parents';

  const showParents =
    showParentsBlock &&
    sessionType &&
    sessionType !== 'CLASS' &&
    !!onParentAttendanceUpdate &&
    (sessionParents.length > 0 || !!onAddParentToSession);

  const getParentAttendance = (parentId: string) =>
    parentAttendance.find((p) => p.parentId === parentId)?.attended ?? false;

  const setParentAttendance = (parentId: string, attended: boolean) => {
    if (!onParentAttendanceUpdate) return;
    const others = parentAttendance.filter((p) => p.parentId !== parentId);
    onParentAttendanceUpdate([...others, { parentId, attended }]);
  };

  if (section === 'parents' && !showParents) {
    return null;
  }

  return (
    <div className="space-y-4">
      {title && section === 'both' && <h2 className="text-xl font-semibold">{title}</h2>}

      {showStudentsBlock && (
        <>
          {studentsProcessed.length > 0 ? (
            <div className="border rounded-lg overflow-hidden w-full min-w-0">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-0 w-[40%]">Student</TableHead>
                    {allowAbsenceLogging ? (
                      <>
                        <TableHead className="min-w-0 w-[30%]">Planned attendance</TableHead>
                        <TableHead className="min-w-0 w-[30%]">Actual attendance</TableHead>
                      </>
                    ) : (
                      <TableHead className="min-w-0 w-[35%]">Planned</TableHead>
                    )}
                    {!allowAbsenceLogging ? (
                      <TableHead className="min-w-0 w-[25%]">Actual</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsProcessed.map((data) => {
                    const attendance = getStudentAttendance(data.student.id);
                    const isAttended = attendance ? Boolean(attendance.attended) : !data.plannedAbsence;
                    const isDraftExtra = data.sessionsStudentsId === TUTOR_LOG_DRAFT_SESSIONS_STUDENTS_ID;

                    const actualCheckbox = (
                      <Checkbox
                        id={`student-${data.student.id}`}
                        checked={isAttended}
                        onCheckedChange={(checked) =>
                          handleAttendanceChange(data.student.id, checked === true)
                        }
                      />
                    );

                    return (
                      <TableRow key={data.student.id}>
                        <TableCell className="font-medium min-w-0 align-middle">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">
                              {data.student.first_name} {data.student.last_name}
                            </span>
                            {isDraftExtra ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 shrink-0 p-0"
                                onClick={() => handleRemoveStudent(data.student.id)}
                                aria-label="Remove student from log"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        {allowAbsenceLogging ? (
                          <>
                            <TableCell className="min-w-0 align-middle">
                              <AttendanceCell
                                status={data.plannedStatus}
                                linkText={data.rescheduledDate || undefined}
                              />
                            </TableCell>
                            <TableCell className="min-w-0 align-middle">{actualCheckbox}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="min-w-0 align-middle">
                              <AttendanceCell status={data.plannedStatus} />
                            </TableCell>
                            <TableCell className="min-w-0 align-middle">{actualCheckbox}</TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No students on this session.</p>
          )}

          {addStudentVariant === 'search' && onAddStudentToSession ? (
            <MeetingEntitySearchAdd
              kind="student"
              placeholder="Search students…"
              existingIds={studentsProcessed.map((d) => d.student.id)}
              onPick={async (student) => {
                await onAddStudentToSession(student.id);
                await queryClient.invalidateQueries({
                  queryKey: [...sessionsKeys.detail(sessionId), 'forLogging'],
                });
                handleAddStudent(student.id);
              }}
            />
          ) : (
            <>
              {!showSearch && (
                <Button variant="outline" onClick={() => setShowSearch(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Student
                </Button>
              )}

              {showSearch && (
                <div className="space-y-2 border rounded-md p-4 bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleAddStudent(student.id)}
                        className="w-full text-left p-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded-md transition-colors"
                      >
                        <span>
                          {student.first_name} {student.last_name}
                        </span>
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No students found
                      </div>
                    )}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setShowSearch(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showParents && (
        <>
          {section === 'both' && (
            <>
              <div className="border-t pt-4 mt-4" />
              <p className="text-sm text-muted-foreground">
                Record whether each linked parent attended this meeting.
              </p>
            </>
          )}
          {sessionParents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parents linked to this session.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden w-full min-w-0">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-0 w-[45%]">Parent</TableHead>
                    {allowAbsenceLogging ? (
                      <>
                        <TableHead className="min-w-0 w-[27%]">Planned attendance</TableHead>
                        <TableHead className="min-w-0 w-[28%]">Actual attendance</TableHead>
                      </>
                    ) : (
                      <TableHead className="min-w-0">Attendance</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionParents.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium min-w-0 align-middle">
                        {p.first_name} {p.last_name}
                      </TableCell>
                      {allowAbsenceLogging ? (
                        <>
                          <TableCell className="min-w-0 align-middle">
                            <AttendanceCell status="attending" />
                          </TableCell>
                          <TableCell className="min-w-0 align-middle">
                            <Checkbox
                              id={`parent-${p.id}`}
                              checked={getParentAttendance(p.id)}
                              onCheckedChange={(checked) =>
                                setParentAttendance(p.id, checked === true)
                              }
                            />
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="min-w-0 align-middle">
                          <Checkbox
                            id={`parent-${p.id}`}
                            checked={getParentAttendance(p.id)}
                            onCheckedChange={(checked) =>
                              setParentAttendance(p.id, checked === true)
                            }
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {onAddParentToSession && (
            <MeetingEntitySearchAdd
              kind="parent"
              placeholder="Search parents…"
              existingIds={sessionParents.map((parent) => parent.id)}
              onPick={async (parent) => {
                await onAddParentToSession(parent.id);
                await queryClient.invalidateQueries({
                  queryKey: [...sessionsKeys.detail(sessionId), 'forLogging'],
                });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
