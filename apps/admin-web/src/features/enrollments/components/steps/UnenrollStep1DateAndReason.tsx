'use client';

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { formatClassName, formatDate, cn } from '@/shared/utils';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { EnrollmentWeekCalendar } from '../EnrollmentWeekCalendar';
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
  studentSubjects: _studentSubjects,
  classData,
  classSubject,
  classStaff: _classStaff,
  unenrollmentDate,
  reason: _reason,
  onDateChange,
  onReasonChange: _onReasonChange,
}: UnenrollStep1DateAndReasonProps) {
  // Get student name
  const studentName = `${student.first_name} ${student.last_name}`;

  // Get class name
  const className = classData && classSubject
    ? formatClassName(classData, classSubject)
    : 'choose class';

  // Generate list of future session dates (next 16 weeks worth)
  const futureSessionDates = useMemo(() => {
    if (!classData || classData.day_of_week === null || classData.day_of_week === undefined) {
      return [];
    }

    const today = getMidnightAdelaide(new Date());
    const firstSession = calculateFirstSessionDate(
      {
        day_of_week: classData.day_of_week,
        start_time: classData.start_time || '09:00',
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
  }, [classData]);

  const isClassChosen = className !== 'choose class';
  const isDateChosen = !!unenrollmentDate && unenrollmentDate.trim() !== '' && futureSessionDates.length > 0;

  // Handle session date selection - set unenrollment date to day after selected session
  const handleSessionDateChange = (sessionDateStr: string) => {
    // Set unenrollment date to the day after the selected session
    // This ensures the selected session is the final one
    const sessionDate = new Date(sessionDateStr);
    const unenrollDate = addDays(sessionDate, 1);
    onDateChange(unenrollDate.toISOString().split('T')[0]);
  };

  // Get the session date from unenrollment date (unenrollment date is day after session)
  const selectedSessionDate = useMemo(() => {
    if (!unenrollmentDate) return undefined;
    const unenrollDate = new Date(unenrollmentDate);
    const sessionDate = addDays(unenrollDate, -1);
    return sessionDate.toISOString().split('T')[0];
  }, [unenrollmentDate]);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card */}
      <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
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
            isClassChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {className}
          </span>
          {', their final session will be '}
          <span className="inline-flex items-center">
            {futureSessionDates.length > 0 ? (
              <Select
                value={selectedSessionDate || undefined}
                onValueChange={handleSessionDateChange}
              >
                <SelectTrigger className={cn(
                  "h-8 text-sm font-semibold border focus:ring-primary/20 w-auto min-w-[180px]",
                  isDateChosen
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                )}>
                  <SelectValue placeholder="Select final session" />
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
        {classData && futureSessionDates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Student will be removed from all sessions after this date
          </p>
        )}
      </div>

      {/* Student Calendar View */}
      {student.id && classData && selectedSessionDate && (
        <div className="mt-4">
          <EnrollmentWeekCalendar
            studentId={student.id}
            selectedStudent={student}
            enrollmentDate={selectedSessionDate}
            selectedClass={undefined}
            onEnrollmentDateChange={onDateChange}
            isUnenrollMode={true}
            unenrollingClassId={classData.id}
            finalSessionDate={selectedSessionDate}
          />
        </div>
      )}
    </div>
  );
}

