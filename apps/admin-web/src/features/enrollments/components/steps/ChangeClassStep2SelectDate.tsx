'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { EnrollmentWeekCalendar } from '../EnrollmentWeekCalendar';

interface ChangeClassStep2SelectDateProps {
  changeoverDate: string;
  onDateChange: (date: string) => void;
  studentId: string;
  selectedStudent: Tables<'students'>;
  selectedNewClass: ClassWithExpandedSubject | undefined;
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
}

export function ChangeClassStep2SelectDate({
  changeoverDate,
  onDateChange,
  studentId,
  selectedStudent,
  selectedNewClass,
  oldClass,
  oldClassSubject,
  oldClassStaff,
}: ChangeClassStep2SelectDateProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="changeover-date">Changeover Date</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="changeover-date"
            type="date"
            value={changeoverDate}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Student will be unenrolled from the old class and enrolled in the new class on this date
        </p>
      </div>

      {/* Week Calendar View */}
      {selectedNewClass && (
        <div className="mt-4">
          <EnrollmentWeekCalendar
            studentId={studentId}
            selectedStudent={selectedStudent}
            enrollmentDate={changeoverDate}
            selectedClass={selectedNewClass}
            oldClass={oldClass}
            oldClassSubject={oldClassSubject}
            oldClassStaff={oldClassStaff}
            isChangeClassMode={true}
            onEnrollmentDateChange={onDateChange}
          />
        </div>
      )}
    </div>
  );
}

