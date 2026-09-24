'use client';

import { SearchableSelect } from '@altitutor/ui';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { useClassTransferSessions, sessionCalendarDate, sessionDateLabel } from '../../hooks/useClassTransferSessions';

interface ChangeClassStep2SelectDateProps {
  lastOldClassDate: string;
  firstNewClassDate: string;
  onLastDateChange: (date: string) => void;
  onFirstDateChange: (date: string) => void;
  selectedNewClass: ClassWithExpandedSubject | undefined;
  oldClass: Tables<'classes'>;
}

export function ChangeClassStep2SelectDate({
  lastOldClassDate, firstNewClassDate, onLastDateChange, onFirstDateChange, selectedNewClass, oldClass,
}: ChangeClassStep2SelectDateProps) {
  const { data: sessions = [], isLoading, error } = useClassTransferSessions(oldClass.id, selectedNewClass?.id);
  const options = (classId: string, timezone: string) => [...new Map(sessions
    .filter(session => session.class_id === classId)
    .map(session => [sessionCalendarDate(session.start_at, timezone), {
      id: sessionCalendarDate(session.start_at, timezone), label: sessionDateLabel(session.start_at, timezone),
    }])).values()];
  const oldDates = options(oldClass.id, oldClass.schedule_timezone);
  const newDates = selectedNewClass ? options(selectedNewClass.id, selectedNewClass.schedule_timezone) : [];
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
      {!isLoading && !error && (!oldDates.length || !newDates.length) && <p role="alert">Both classes need scheduled sessions before this transfer can be confirmed.</p>}
    </div>
  );
}
