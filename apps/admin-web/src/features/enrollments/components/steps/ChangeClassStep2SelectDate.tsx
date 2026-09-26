'use client';

import { useEffect } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { useClassTransferSessions, sessionCalendarDate, sessionDateLabel } from '../../hooks/useClassTransferSessions';
import { finalClassDateIsAfterEnrolment, firstNewClassWarnings, selectableLastOldClassDates } from '../../utils/changeClassDates';

interface ChangeClassStep2SelectDateProps {
  studentId: string;
  subjectName?: string;
  lastOldClassDate: string;
  firstNewClassDate: string;
  onLastDateChange: (date: string) => void;
  onFirstDateChange: (date: string) => void;
  selectedNewClass: ClassWithExpandedSubject | undefined;
  oldClass: Tables<'classes'>;
}

export function ChangeClassStep2SelectDate({
  studentId, subjectName = 'this subject', lastOldClassDate, firstNewClassDate, onLastDateChange, onFirstDateChange, selectedNewClass, oldClass,
}: ChangeClassStep2SelectDateProps) {
  const { data: sessions = [], enrolledAt, isLoading, error } = useClassTransferSessions(oldClass.id, selectedNewClass?.id, studentId);
  const oldTimezone = oldClass.schedule_timezone;
  const newTimezone = selectedNewClass?.schedule_timezone ?? oldTimezone;
  const dated = (classId: string, timezone: string) => sessions.flatMap((session) => (
    session.class_id === classId
      ? [{ ...session, calendarDate: sessionCalendarDate(session.start_at, timezone) }]
      : []
  ));
  const oldSessions = dated(oldClass.id, oldTimezone);
  const newSessions = selectedNewClass ? dated(selectedNewClass.id, newTimezone) : [];
  const allowedOldDates = new Set(selectableLastOldClassDates({
    sessions: oldSessions.map((session) => ({
      calendarDate: session.calendarDate,
      logged: session.logged,
      studentAttended: session.studentAttended,
    })),
    enrolledAt,
    timezone: oldTimezone,
  }));
  const allowedOldKey = [...allowedOldDates].sort().join('|');
  const options = (rows: Array<{ calendarDate: string; start_at: string }>, timezone: string, allowed?: Set<string>) => [...new Map(rows
    .filter((session) => !allowed || allowed.has(session.calendarDate))
    .map((session) => [session.calendarDate, {
      id: session.calendarDate,
      label: sessionDateLabel(session.start_at, timezone),
    }])).values()];
  const oldDates = options(oldSessions, oldTimezone, allowedOldDates);
  const newDates = options(newSessions, newTimezone);
  const today = sessionCalendarDate(new Date().toISOString(), newTimezone);
  const keptOldDates = [...new Set(oldSessions.map((session) => session.calendarDate))]
    .filter((date) => lastOldClassDate && date <= lastOldClassDate && (!enrolledAt || finalClassDateIsAfterEnrolment(date, enrolledAt, oldTimezone)));
  const warnings = firstNewClassDate
    ? firstNewClassWarnings({
      firstNewDate: firstNewClassDate,
      today,
      keptOldDates,
      newClassDates: [...new Set(newSessions.map((session) => session.calendarDate))],
    })
    : { past: false, sameWeek: false };
  const hiddenOldDates = new Set(oldSessions.map((session) => session.calendarDate)).size > oldDates.length;

  useEffect(() => {
    if (!isLoading && lastOldClassDate && !allowedOldKey.split('|').includes(lastOldClassDate)) onLastDateChange('');
  }, [allowedOldKey, isLoading, lastOldClassDate, onLastDateChange]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Choose the final lesson to keep in the old class and the first lesson in the new class. Both selected dates are included.</p>
      {isLoading && <p role="status">Loading class sessions…</p>}
      {error && <p role="alert">Unable to load class sessions. Please close and retry.</p>}
      <div className="space-y-2">
        <p id="last-old-class-label" className="font-medium">Last date in old class</p>
        <p className="text-sm text-muted-foreground">{oldClass.long_name}</p>
        <SearchableSelect items={oldDates} value={oldDates.find(date => date.id === lastOldClassDate) ?? null}
          onValueChange={date => date && onLastDateChange(date.id)} getItemId={date => date.id} getItemLabel={date => date.label}
          placeholder="Select final old-class session" ariaLabel="Last date in old class" />
        {hiddenOldDates && (
          <p className="text-sm text-muted-foreground">Lessons before a later logged or attended lesson are hidden, as are lessons before this enrolment started.</p>
        )}
      </div>
      <div className="space-y-2">
        <p id="first-new-class-label" className="font-medium">First date in new class</p>
        <p className="text-sm text-muted-foreground">{selectedNewClass?.long_name}</p>
        <SearchableSelect items={newDates} value={newDates.find(date => date.id === firstNewClassDate) ?? null}
          onValueChange={date => date && onFirstDateChange(date.id)} getItemId={date => date.id} getItemLabel={date => date.label}
          placeholder="Select first new-class session" ariaLabel="First date in new class" />
      </div>
      {lastOldClassDate && firstNewClassDate && lastOldClassDate >= firstNewClassDate && (
        <p role="alert" className="text-sm text-destructive">The first new-class date must be after the final old-class date.</p>
      )}
      {warnings.past && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">This first lesson is in the past.</p>
      )}
      {warnings.sameWeek && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">The student would have two {subjectName} lessons in the same week.</p>
      )}
      {!isLoading && !error && (!oldDates.length || !newDates.length) && <p role="alert">Both classes need scheduled sessions before this transfer can be confirmed.</p>}
    </div>
  );
}
