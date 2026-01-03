'use client';

import { useState, useMemo } from 'react';
import type { StudentSession } from '../types/absence';
import { WeekViewCalendar } from './WeekViewCalendar';

interface AbsenceSessionSelectorProps {
  sessions: StudentSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function AbsenceSessionSelector({
  sessions,
  selectedSessionId,
  onSelectSession,
  isLoading = false,
}: AbsenceSessionSelectorProps) {
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

  // Convert sessions to base format for WeekViewCalendar
  const baseSessions = useMemo(() => {
    return sessions.map((s) => ({
      id: s.id,
      start_at: s.start_at,
      end_at: s.end_at,
      class_id: s.class_id,
      type: s.type,
      subject_name: s.subject?.name || null,
      subject_curriculum: s.subject?.curriculum || null,
      subject_level: s.subject?.level || null,
      subject_year_level: s.subject?.year_level || null,
      session_type: s.type,
    }));
  }, [sessions]);

  const selectedSessionIds = useMemo(() => {
    return selectedSessionId ? new Set([selectedSessionId]) : new Set<string>();
  }, [selectedSessionId]);

  const handleToggleSession = (sessionId: string) => {
    // Only allow single selection - if clicking the same session, deselect it
    if (selectedSessionId === sessionId) {
      // Don't call onSelectSession with null, just clear selection
      // The parent should handle this
      return;
    }
    onSelectSession(sessionId);
  };

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
        No future sessions found.
      </div>
    );
  }

  return (
    <WeekViewCalendar
      sessions={baseSessions}
      selectedSessionIds={selectedSessionIds}
      onToggleSession={handleToggleSession}
      currentWeekStart={currentWeekStart}
      onWeekChange={setCurrentWeekStart}
      minDate={minDate}
    />
  );
}
