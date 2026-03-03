'use client';

import { Separator } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import type { TutorLogFormData } from '../../types';
import { formatSessionDate } from '@/features/sessions/utils/session-helpers';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { format } from 'date-fns';
import { StudentCard } from '@/shared/components/StudentCard';
import { StaffCard } from '@/shared/components/StaffCard';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { FileCard } from '@/shared/components/files/FileCard';
import { TopicCard } from '../TopicCard';
import { useStep9ConfirmationData } from '../../hooks/useStep9ConfirmationData';

type Step9ConfirmationProps = {
  title?: string;
  formData: Partial<TutorLogFormData>;
};

export function Step9Confirmation({
  title,
  formData,
}: Step9ConfirmationProps) {
  const { data } = useStep9ConfirmationData(
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

  const studentsData = (formData.studentAttendance || [])
    .filter((sa) => sa.attended)
    .map((sa) => {
      const student = studentsMap.get(sa.studentId);
      if (!student) return null;
      return {
        student,
        plannedStatus: 'attending' as const,
        actualStatus: 'attended' as const,
      };
    })
    .filter((data): data is NonNullable<typeof data> => data !== null);

  const staffData = (formData.staffAttendance || [])
    .filter((sa) => sa.attended)
    .map((sa) => {
      const staff = staffMap.get(sa.staffId);
      if (!staff) return null;
      return {
        staff,
        plannedStatus: 'attending' as const,
        actualStatus: 'attended' as const,
        staffType: sa.type,
        submittedTutorLog: false,
      };
    })
    .filter((data): data is NonNullable<typeof data> => data !== null);

  // Get subject from class if available, otherwise from direct subject relation
  const subject = session?.class?.subject || session?.subject;

  // Format time from session timestamps
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

  return (
    <div className="space-y-6">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      {/* Session Information */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Session Information</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="text-sm font-medium text-muted-foreground">Day:</div>
          <div className="text-sm">{session?.start_at ? formatSessionDate(session.start_at) : '—'}</div>
          
          <div className="text-sm font-medium text-muted-foreground">Time:</div>
          <div className="text-sm">{formatSessionTime()}</div>
          
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
            {studentsData.map((data) => (
              <div key={data.student.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <StudentCard
                    student={data.student}
                    showSubjects={false}
                    showActions={false}
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
          <h3 className="text-lg font-semibold mb-4">Staff ({staffData.length})</h3>
        {staffData.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No staff planned
          </div>
        ) : (
          <div className="space-y-3">
            {staffData.map((data) => (
              <div key={data.staff.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <StaffCard
                    staff={data.staff}
                    showSubjects={false}
                    showActions={false}
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

      {/* Topics Section */}
      {(formData.topics || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Topics Covered</h3>
            <div className="space-y-4">
              {(formData.topics || []).map((topic) => {
                const topicData = topicsMap.get(topic.topicId);
                if (!topicData) return null;
                const students = topic.studentIds || [];
                const parentTopic = topicData.parent_id ? allTopics.find((t) => t.id === topicData.parent_id) : undefined;
                const subject = topicData.subject_id ? subjectsMap.get(topicData.subject_id) : undefined;
                
                return (
                  <div key={topic.topicId} className="border rounded-lg p-4 space-y-3">
                    <TopicCard
                      topic={topicData}
                      subject={subject}
                      parentTopic={parentTopic}
                    />
                    
                    {students.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                        <div className="flex flex-wrap gap-1">
                          {students.slice(0, 5).map((studentId: string) => {
                            const student = studentsMap.get(studentId);
                            if (!student) return null;
                            return (
                              <div key={studentId} className="cursor-pointer">
                                <StudentCard
                                  student={student}
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

      {/* Files Section */}
      {(formData.topicFiles || []).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Files Used</h3>
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
                          <div key={file.topicsFilesId} className="text-sm text-muted-foreground p-2 border rounded">
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

      {/* Notes */}
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


