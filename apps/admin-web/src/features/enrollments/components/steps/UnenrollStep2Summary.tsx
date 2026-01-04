'use client';

import { Label } from '@altitutor/ui';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables } from '@altitutor/shared';

interface UnenrollStep2SummaryProps {
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  unenrollmentDate: string;
  reason: string;
}

export function UnenrollStep2Summary({
  student,
  studentSubjects,
  classData,
  classSubject,
  classStaff,
  unenrollmentDate,
  reason,
}: UnenrollStep2SummaryProps) {
  // Calculate last session date
  const lastSessionDate = classData && unenrollmentDate
    ? calculateLastSessionDate(classData, getMidnightAdelaide(new Date(unenrollmentDate)))
    : null;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Student</Label>
        <StudentCard
          student={student}
          subjects={studentSubjects}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Class</Label>
        <ClassCard
          class={classData}
          subject={classSubject}
          staff={classStaff || []}
        />
      </div>

      {lastSessionDate && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Last Session</p>
          <p className="text-sm text-muted-foreground">
            {formatSessionDateTime(lastSessionDate)}
          </p>
        </div>
      )}

      {reason && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Reason</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {reason}
          </p>
        </div>
      )}
    </div>
  );
}

