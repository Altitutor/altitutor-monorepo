'use client';

import { calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { formatClassName, formatDate, cn } from '@/shared/utils';
import { NotesEditorWithMentions } from '@/shared/components/NotesEditorWithMentions';
import type { Tables } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';

interface UnenrollStep2SummaryProps {
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  unenrollmentDate: string;
  reason: JSONContent;
  onReasonChange: (reason: JSONContent) => void;
}

export function UnenrollStep2Summary({
  student,
  studentSubjects: _studentSubjects,
  classData,
  classSubject,
  classStaff: _classStaff,
  unenrollmentDate,
  reason,
  onReasonChange,
}: UnenrollStep2SummaryProps) {
  // Calculate last session date
  const lastSessionDate = classData && unenrollmentDate
    ? calculateLastSessionDate(classData, getMidnightAdelaide(new Date(unenrollmentDate)))
    : null;

  // Get student name
  const studentName = `${student.first_name} ${student.last_name}`;

  // Get class name
  const className = classData && classSubject
    ? formatClassName(classData, classSubject)
    : 'choose class';

  // Format final session date for display
  const finalSessionDateDisplay = lastSessionDate
    ? formatSessionDateTime(lastSessionDate)
    : unenrollmentDate
    ? formatDate(new Date(unenrollmentDate))
    : 'choose date';

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">
          Unenroll{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {studentName}
          </span>
          {' from '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {className}
          </span>
          {', their final session will be '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {finalSessionDateDisplay}
          </span>
        </p>
      </div>

      {/* Reason Rich Text */}
      <div className="space-y-2">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason for Unenrollment <span className="text-destructive">*</span>
        </label>
        <NotesEditorWithMentions
          content={reason}
          onChange={onReasonChange}
          placeholder="Enter reason for unenrolling this student..."
          minHeight="100px"
        />
        <p className="text-xs text-muted-foreground">
          Please provide a reason for unenrolling this student from the class.
        </p>
      </div>
    </div>
  );
}

