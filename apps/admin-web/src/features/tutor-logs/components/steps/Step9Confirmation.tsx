'use client';

import {
  Badge,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import type { TutorLogFormData } from '../../types';
import { formatSessionDate } from '@/features/sessions/utils/session-helpers';
import { getSubjectColorStyle } from '@/shared/utils';
import { format } from 'date-fns';
import { StudentCard } from '@/shared/components/StudentCard';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { FileCard } from '@/shared/components/files/FileCard';
import { TopicCard } from '../TopicCard';
import { useStep9ConfirmationData } from '../../hooks/useStep9ConfirmationData';

type Step9ConfirmationProps = {
  title?: string;
  formData: Partial<TutorLogFormData>;
};

export function Step9Confirmation({ title, formData }: Step9ConfirmationProps) {
  const { data, isLoading } = useStep9ConfirmationData(
    formData.sessionId,
    formData,
    !!formData.sessionId
  );

  const session = data?.session ?? null;
  const studentsMap = data?.studentsMap ?? new Map();
  const staffMap = data?.staffMap ?? new Map();
  const topicsMap = data?.topicsMap ?? new Map();
  const allTopics = data?.allTopics ?? [];
  const topicFilesMap = data?.topicFilesMap ?? new Map();
  const subjectsMap = data?.subjectsMap ?? new Map();
  const studentPlannedMap = data?.studentPlannedMap ?? new Map();
  const staffPlannedMap = data?.staffPlannedMap ?? new Map();
  const parentsMap = data?.parentsMap ?? new Map();

  const isMeeting = session?.type != null && session.type !== 'CLASS';

  const subject = session?.class?.subject || session?.subject;

  const formatSessionTime = () => {
    if (!session?.start_at || !session?.end_at) return '—';
    try {
      const start = new Date(session.start_at);
      const end = new Date(session.end_at);
      return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
    } catch {
      return '—';
    }
  };

  const studentRows = (formData.studentAttendance || []).map((sa) => {
    const student = studentsMap.get(sa.studentId);
    if (!student) return null;
    const plannedAbsent = studentPlannedMap.get(sa.studentId) ?? false;
    const plannedStatus = plannedAbsent ? ('absent' as const) : ('attending' as const);
    const actualStatus = sa.attended ? ('attended' as const) : ('did-not-attend' as const);
    return { student, plannedStatus, actualStatus };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const staffRows = (formData.staffAttendance || []).map((sa) => {
    const staff = staffMap.get(sa.staffId);
    if (!staff) return null;
    const plannedAbsent = staffPlannedMap.get(sa.staffId) ?? false;
    const plannedStatus = plannedAbsent ? ('absent' as const) : ('attending' as const);
    const actualStatus = sa.attended
      ? ('attended' as const)
      : ('did-not-attend' as const);
    return { staff, plannedStatus, actualStatus, staffType: sa.type };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const parentRows = (formData.parentAttendance || []).map((pa) => {
    const parent = parentsMap.get(pa.parentId);
    if (!parent) return null;
    const actualStatus = pa.attended ? ('attended' as const) : ('did-not-attend' as const);
    return { parent, actualStatus };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (isLoading && !data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading confirmation…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <div>
        <h3 className="text-lg font-semibold mb-4">Session information</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="text-sm font-medium text-muted-foreground">Day:</div>
          <div className="text-sm">{session?.start_at ? formatSessionDate(session.start_at) : '—'}</div>

          <div className="text-sm font-medium text-muted-foreground">Time:</div>
          <div className="text-sm">{formatSessionTime()}</div>

          <div className="text-sm font-medium text-muted-foreground">Subject:</div>
          <div className="text-sm">
            {subject ? (
              (() => {
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                return (
                  <Badge
                    className={defaultClass || textColorClass}
                    style={style.backgroundColor ? style : undefined}
                  >
                    {subject?.long_name ?? ''}
                  </Badge>
                );
              })()
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">Students ({studentRows.length})</h3>
        {studentRows.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">No students on this log</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  {!isMeeting && <TableHead>Planned attendance</TableHead>}
                  <TableHead>Actual attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentRows.map(({ student, plannedStatus, actualStatus }) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    {!isMeeting && (
                      <TableCell>
                        <AttendanceCell status={plannedStatus} />
                      </TableCell>
                    )}
                    <TableCell>
                      <AttendanceCell status={actualStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">Staff ({staffRows.length})</h3>
        {staffRows.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">No staff on this log</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  {!isMeeting && <TableHead>Planned attendance</TableHead>}
                  <TableHead>Actual attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffRows.map(({ staff, plannedStatus, actualStatus, staffType }) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      {staff.first_name} {staff.last_name}
                    </TableCell>
                    {!isMeeting && (
                      <TableCell>
                        <AttendanceCell status={plannedStatus} />
                      </TableCell>
                    )}
                    <TableCell>
                      <AttendanceCell
                        status={actualStatus}
                        staffType={
                          staffType as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {isMeeting && (formData.parentAttendance || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Parents ({(formData.parentAttendance || []).length})
            </h3>
            {isLoading && parentRows.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading parent names…</div>
            ) : parentRows.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">Parent details unavailable</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parent</TableHead>
                      <TableHead>Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parentRows.map(({ parent, actualStatus }) => (
                      <TableRow key={parent.id}>
                        <TableCell className="font-medium">
                          {parent.first_name} {parent.last_name}
                        </TableCell>
                        <TableCell>
                          <AttendanceCell status={actualStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}

      {(formData.topics || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Topics covered</h3>
            <div className="space-y-4">
              {(formData.topics || []).map((topic) => {
                const topicData = topicsMap.get(topic.topicId);
                if (!topicData) return null;
                const students = topic.studentIds || [];
                const parentTopic = topicData.parent_id
                  ? allTopics.find((t) => t.id === topicData.parent_id)
                  : undefined;
                const topicSubject = topicData.subject_id
                  ? subjectsMap.get(topicData.subject_id)
                  : undefined;

                return (
                  <div key={topic.topicId} className="border rounded-lg p-4 space-y-3">
                    <TopicCard
                      topic={topicData}
                      subject={topicSubject}
                      parentTopic={parentTopic}
                    />

                    {students.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                        <div className="flex flex-wrap gap-1">
                          {students.slice(0, 5).map((studentId: string) => {
                            const st = studentsMap.get(studentId);
                            if (!st) return null;
                            return (
                              <div key={studentId} className="cursor-pointer">
                                <StudentCard
                                  student={st}
                                  showSubjects={false}
                                  showActions={false}
                                />
                              </div>
                            );
                          })}
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

      {(formData.topicFiles || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Files used</h3>
            <div className="space-y-4">
              {(formData.topics || []).map((topic) => {
                const topicData = topicsMap.get(topic.topicId);
                if (!topicData) return null;
                const topicCode = topicData.code || '';
                const files = (formData.topicFiles || []).filter((tf) => tf.topicId === topic.topicId);

                if (files.length === 0) return null;

                return (
                  <div key={topic.topicId} className="space-y-3">
                    <div className="font-semibold text-base">
                      {topicCode} {topicData.name}
                    </div>
                    <div className="space-y-2">
                      {files.map((file) => {
                        const fileData = topicFilesMap.get(file.topicsFilesId);
                        if (!fileData) return null;
                        const fileCode = fileData.code || '';

                        return fileData.file?.filename ? (
                          <FileCard
                            key={file.topicsFilesId}
                            fileCode={fileCode}
                            fileType={fileData.type}
                            filename={fileData.file.filename}
                            storagePath={fileData.file.storage_path}
                            mimeType={fileData.file.mimetype || undefined}
                            topicFileId={fileData.id}
                          />
                        ) : (
                          <div
                            key={file.topicsFilesId}
                            className="text-sm text-muted-foreground p-2 border rounded"
                          >
                            File name unavailable
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {(formData.notes || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Notes ({formData.notes?.length || 0})</h3>
            <div className="space-y-2">
              {(formData.notes || []).map((note, index) => (
                <div key={index} className="text-sm p-2 bg-muted/30 rounded">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
