'use client';

import { useState, useMemo } from 'react';
import type { StaffSession } from '../types/staff-absence';
import { WeekViewCalendar } from './WeekViewCalendar';

interface StaffAbsenceSessionSelectorProps {
  sessions: StaffSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function StaffAbsenceSessionSelector({
  sessions,
  selectedSessionIds,
  onToggleSession,
  isLoading = false,
}: StaffAbsenceSessionSelectorProps) {
  // Get the current week start (Monday of current week)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentWeekStart = new Date(today);
    // Calculate Monday of current week
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
  });

  // Minimum date is the start of the current week (Monday containing today)
  const minDate = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const min = new Date(today);
    // Calculate Monday of current week
    const diff = min.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    min.setDate(diff);
    min.setHours(0, 0, 0, 0);
    return min;
  }, []);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No future sessions found for this staff member.
      </div>
    );
  }

  return (
    <WeekViewCalendar
      sessions={sessions}
      selectedSessionIds={selectedSessionIds}
      onToggleSession={onToggleSession}
      currentWeekStart={currentWeekStart}
      onWeekChange={setCurrentWeekStart}
      minDate={minDate}
    />
  );
}

