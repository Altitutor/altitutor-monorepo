'use client';

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { SearchableSelect } from '@altitutor/ui';
import { formatDate, cn } from '@/shared/utils';
import { calculateFirstSessionDate, calculateLastSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { EnrollmentWeekCalendar } from '../EnrollmentWeekCalendar';
import type { Tables } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';

interface UnenrollStep1DateAndReasonProps {
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  unenrollmentDate: string;
  reason: JSONContent | undefined;
  onDateChange: (date: string) => void;
  onReasonChange: (reason: JSONContent) => void;
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
    ? (classData.long_name?.trim() ?? '')
    : 'choose class';

  // Generate dropdown options: most recent past session + next 16 future sessions
  const sessionDateOptions = useMemo(() => {
    if (!classData || classData.day_of_week === null || classData.day_of_week === undefined) {
      return [];
    }

    const today = getMidnightAdelaide(new Date());
    const mostRecentPastSession = calculateLastSessionDate(
      {
        day_of_week: classData.day_of_week,
        start_time: classData.start_time || '09:00',
      },
      today
    );

    const firstSession = calculateFirstSessionDate(
      {
        day_of_week: classData.day_of_week,
        start_time: classData.start_time || '09:00',
      },
      today
    );

    const dates: Array<{ value: string; label: string }> = [];

    if (mostRecentPastSession) {
      const lastPastDateStr = mostRecentPastSession.toISOString().split('T')[0];
      dates.push({
        value: lastPastDateStr,
        label: `${formatDate(mostRecentPastSession)} (Most recent past)`,
      });
    }

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
  const isDateChosen = !!unenrollmentDate && unenrollmentDate.trim() !== '' && sessionDateOptions.length > 0;

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
            {sessionDateOptions.length > 0 ? (
              <SearchableSelect<{ value: string; label: string }>
                items={sessionDateOptions}
                value={sessionDateOptions.find((d) => d.value === selectedSessionDate) ?? null}
                onValueChange={(item) => item && handleSessionDateChange(item.value)}
                getItemLabel={(d) => d.label}
                getItemId={(d) => d.value}
                placeholder="Select final session"
                triggerClassName={cn(
                  "h-8 text-sm font-semibold w-auto min-w-[180px]",
                  isDateChosen
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                )}
              />
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-sm font-semibold">
                choose class
              </span>
            )}
          </span>
        </p>
        {classData && sessionDateOptions.length > 0 && (
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

