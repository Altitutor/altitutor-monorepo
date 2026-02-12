'use client';

import { Badge } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import type { TutorLogFormData } from '../../types';
import { useTutorLogStep9Data } from '../../hooks/useTutorLogStep9Data';
import { format } from 'date-fns';

type Step9ConfirmationProps = {
  formData: Partial<TutorLogFormData>;
  onSubmit: () => void;
  isSubmitting: boolean;
};

export function Step9Confirmation({
  formData,
  onSubmit: _onSubmit,
  isSubmitting: _isSubmitting,
}: Step9ConfirmationProps) {
  const {
    session,
    studentsMap,
    staffMap,
    topicsMap,
    topicFilesMap,
  } = useTutorLogStep9Data(formData);

  const attendedStudents = formData.studentAttendance?.filter((sa) => sa.attended) || [];
  const attendedStaff = formData.staffAttendance?.filter((sa) => sa.attended) || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold">Review and Submit</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Please review the details below before submitting your log.
        </p>
      </div>

      <Separator />

      {/* Session Info */}
      {session && (
        <div>
          <div className="font-medium mb-2">Session</div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Date: </span>
              {session.start_at && format(new Date(session.start_at), 'EEEE, dd MMMM yyyy')}
            </div>
            <div>
              <span className="text-muted-foreground">Time: </span>
              {session.start_at && format(new Date(session.start_at), 'HH:mm')} -{' '}
              {session.end_at && format(new Date(session.end_at), 'HH:mm')}
            </div>
            <div>
              <span className="text-muted-foreground">Subject: </span>
              {session.class?.subject?.name}
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Staff Attendance */}
      <div>
        <div className="font-medium mb-2">Staff Attendance</div>
        <div className="space-y-2">
          {attendedStaff.map((sa) => {
            const staff = staffMap.get(sa.staffId);
            return (
              <div key={sa.staffId} className="flex items-center gap-2 text-sm">
                <Badge variant={sa.type === 'MAIN_TUTOR' ? 'default' : 'outline'}>
                  {sa.type === 'MAIN_TUTOR' ? 'Main Tutor' : sa.type === 'SECONDARY_TUTOR' ? 'Secondary Tutor' : 'Trial Tutor'}
                </Badge>
                <span>
                  {staff?.first_name} {staff?.last_name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Student Attendance */}
      <div>
        <div className="font-medium mb-2">Student Attendance ({attendedStudents.length})</div>
        <div className="flex flex-wrap gap-2">
          {attendedStudents.map((sa) => {
            const student = studentsMap.get(sa.studentId);
            return (
              <Badge key={sa.studentId} variant="secondary">
                {student?.first_name} {student?.last_name}
              </Badge>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Topics */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Topics Covered ({formData.topics?.length || 0})</div>
        {(formData.topics || []).length > 0 ? (
          <div className="space-y-3">
            {(formData.topics || []).map((topic) => {
              const topicData = topicsMap.get(topic.topicId);
              const topicCode = topicData?.code || '';
              const studentIds = topic.studentIds || [];
              return (
                <div key={topic.topicId} className="space-y-2">
                  <div className="text-sm">
                    <span className="font-mono text-muted-foreground">{topicCode}</span>
                    <span className="font-medium ml-2">{topicData?.name}</span>
                  </div>
                  {studentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {studentIds.map((studentId) => {
                        const student = studentsMap.get(studentId);
                        if (!student) return null;
                        return (
                          <Badge key={studentId} variant="secondary" className="text-xs">
                            {student.first_name} {student.last_name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No topics selected</div>
        )}
      </div>

      {/* Files */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Files Used ({formData.topicFiles?.length || 0})</div>
        {(formData.topicFiles || []).length > 0 ? (
          <div className="space-y-3">
            {(formData.topics || []).map((topic) => {
              const topicData = topicsMap.get(topic.topicId);
              const files = (formData.topicFiles || []).filter((tf) => tf.topicId === topic.topicId);
              if (files.length === 0) return null;
              
              return (
                <div key={topic.topicId} className="space-y-2">
                  <div className="text-sm font-medium">{topicData?.name}</div>
                  <div className="space-y-2 pl-4">
                    {files.map((file) => {
                      const fileData = topicFilesMap.get(file.topicsFilesId);
                      if (!fileData) return null;
                      const fileCode = fileData.code || '';
                      const studentIds = file.studentIds || [];
                      
                      return (
                        <div key={file.topicsFilesId} className="space-y-1">
                          <div className="text-sm font-mono text-muted-foreground">{fileCode}</div>
                          {studentIds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {studentIds.map((studentId) => {
                                const student = studentsMap.get(studentId);
                                if (!student) return null;
                                return (
                                  <Badge key={studentId} variant="secondary" className="text-xs">
                                    {student.first_name} {student.last_name}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No files selected</div>
        )}
      </div>

      {/* Notes */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Notes</div>
        {(formData.notes?.length || 0) > 0 ? (
          <div className="space-y-2">
            {(formData.notes || []).map((note, index) => (
              <div key={index} className="text-sm p-2 bg-muted/30 rounded whitespace-pre-wrap">
                {note}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No notes added</div>
        )}
      </div>
    </div>
  );
}


