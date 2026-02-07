'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { formatClassName, formatSubjectDisplay, formatDate, cn } from '@/shared/utils';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
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
  // Get student name
  const studentName = `${selectedStudent.first_name} ${selectedStudent.last_name}`;

  // Get subject name
  const subjectName = oldClassSubject
    ? formatSubjectDisplay(oldClassSubject)
    : 'choose subject';

  // Get old class name
  const oldClassName = oldClass && oldClassSubject
    ? formatClassName(oldClass, oldClassSubject)
    : 'choose class';

  // Get new class name
  const newClassName = selectedNewClass
    ? formatClassName(selectedNewClass, selectedNewClass.subject)
    : 'choose class';

  // Generate list of future session dates for the new class (next 16 weeks worth)
  const futureSessionDates = useMemo(() => {
    if (!selectedNewClass || selectedNewClass.day_of_week === null || selectedNewClass.day_of_week === undefined) {
      return [];
    }

    const today = getMidnightAdelaide(new Date());
    const firstSession = calculateFirstSessionDate(
      {
        day_of_week: selectedNewClass.day_of_week,
        start_time: selectedNewClass.start_time || '09:00',
      },
      today
    );

    const dates: Array<{ value: string; label: string }> = [];
    const currentDate = new Date(firstSession);
    
    // Generate dates for the next 16 weeks (16 sessions)
    for (let i = 0; i < 16; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const formattedDate = formatDate(currentDate);
      dates.push({
        value: dateStr,
        label: formattedDate,
      });
      
      // Move to next week (add 7 days)
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
  }, [selectedNewClass]);

  const isSubjectChosen = subjectName !== 'choose subject';
  const isOldClassChosen = oldClassName !== 'choose class';
  const isNewClassChosen = newClassName !== 'choose class';
  const isDateChosen = !!changeoverDate && changeoverDate.trim() !== '' && futureSessionDates.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card */}
      <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
        <p className="text-sm font-medium">
          Change{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {studentName}
          </span>
          {'\'s '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isSubjectChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {subjectName}
          </span>
          {' class from '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isOldClassChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {oldClassName}
          </span>
          {' to '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isNewClassChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {newClassName}
          </span>
          {' starting on '}
          <span className="inline-flex items-center">
            {futureSessionDates.length > 0 ? (
              <Select
                value={changeoverDate || undefined}
                onValueChange={onDateChange}
              >
                <SelectTrigger className={cn(
                  "h-8 text-sm font-semibold border focus:ring-primary/20 w-auto min-w-[180px]",
                  isDateChosen
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                )}>
                  <SelectValue placeholder="Select session date" />
                </SelectTrigger>
                <SelectContent>
                  {futureSessionDates.map((date) => (
                    <SelectItem key={date.value} value={date.value}>
                      {date.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-sm font-semibold">
                choose class
              </span>
            )}
          </span>
        </p>
        {selectedNewClass && futureSessionDates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Student will be unenrolled from the old class and enrolled in the new class on this date
          </p>
        )}
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

