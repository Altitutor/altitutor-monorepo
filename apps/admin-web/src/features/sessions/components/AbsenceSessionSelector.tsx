'use client';

import { useState, useMemo } from 'react';
import type { StudentSession } from '../types/absence';
import { WeekViewCalendar } from './WeekViewCalendar';

interface AbsenceSessionSelectorProps {
  sessions: StudentSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function AbsenceSessionSelector({
  sessions,
  selectedSessionIds,
  onToggleSession,
  isLoading = false,
}: AbsenceSessionSelectorProps) {
  // Get the current week start (Sunday of current week)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
  });

  // Minimum date is the start of the current week
  const minDate = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const min = new Date(today);
    min.setDate(today.getDate() - dayOfWeek);
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
        No future sessions found for this student.
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
