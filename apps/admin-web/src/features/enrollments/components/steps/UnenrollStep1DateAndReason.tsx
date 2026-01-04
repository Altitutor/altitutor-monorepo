'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import type { Tables } from '@altitutor/shared';

interface UnenrollStep1DateAndReasonProps {
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  unenrollmentDate: string;
  reason: string;
  onDateChange: (date: string) => void;
  onReasonChange: (reason: string) => void;
}

export function UnenrollStep1DateAndReason({
  student,
  studentSubjects,
  classData,
  classSubject,
  classStaff,
  unenrollmentDate,
  reason,
  onDateChange,
  onReasonChange,
}: UnenrollStep1DateAndReasonProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="mb-2">
        <StudentCard
          student={student}
          subjects={studentSubjects}
          showSubjects={true}
        />
      </div>

      <div className="mb-2">
        <ClassCard
          class={classData}
          subject={classSubject}
          staff={classStaff || []}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unenrollment-date">Unenrollment Date</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="unenrollment-date"
            type="date"
            value={unenrollmentDate}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Student will be removed from all sessions after this date
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Unenrollment</Label>
        <Textarea
          id="reason"
          placeholder="Enter reason for unenrolling this student..."
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
}

