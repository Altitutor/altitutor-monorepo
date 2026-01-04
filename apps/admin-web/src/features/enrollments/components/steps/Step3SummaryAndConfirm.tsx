'use client';

import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { calculateFirstSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, EnrollmentConflicts, StudentWithEnrollmentInfo } from '../../types/enrollment';

interface Step3SummaryAndConfirmProps {
  context: EnrollmentContext;
  selectedStudent?: StudentWithEnrollmentInfo | Tables<'students'>;
  selectedClass?: ClassWithExpandedSubject;
  studentSubjects?: Tables<'subjects'>[];
  enrollmentDate: string;
  conflicts: EnrollmentConflicts;
}

export function Step3SummaryAndConfirm({
  context,
  selectedStudent,
  selectedClass,
  studentSubjects,
  enrollmentDate,
  conflicts,
}: Step3SummaryAndConfirmProps) {
  // Calculate first session date
  const firstSessionDate = selectedClass && enrollmentDate && selectedClass.day_of_week !== undefined && selectedClass.start_time
    ? calculateFirstSessionDate(
        { day_of_week: selectedClass.day_of_week, start_time: selectedClass.start_time },
        getMidnightAdelaide(new Date(enrollmentDate))
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {selectedStudent && (
          <div>
            <StudentCard
              student={selectedStudent as Tables<'students'>}
              subjects={('subjects' in selectedStudent ? (selectedStudent as any).subjects : studentSubjects) || []}
              showSubjects={true}
            />
          </div>
        )}

        {selectedClass && (
          <div>
            <ClassCard
              class={selectedClass}
              subject={selectedClass.subject}
              staff={selectedClass.staff || []}
              students={selectedClass.students || []}
            />
          </div>
        )}

        {firstSessionDate && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">First Session</p>
            <p className="text-sm text-muted-foreground">
              {formatSessionDateTime(firstSessionDate)}
            </p>
          </div>
        )}
      </div>

      {/* Warnings */}
      {(conflicts.sameSubjectWarning || conflicts.timeOverlapWarnings.length > 0) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {conflicts.sameSubjectWarning && (
              <p className="font-medium">{conflicts.sameSubjectWarning}</p>
            )}
            {conflicts.timeOverlapWarnings.map((warning, i) => (
              <p key={i} className="text-sm">{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

