"use client";
import type { Tables } from "@altitutor/shared";
import { SessionSelect } from "./SessionSelect";

// Base session type that both StudentSession and RescheduleSession share
type BaseSession = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  class_id: string | null;
  type: Tables<"sessions">["type"] | null;
  short_name?: string | null;
  long_name?: string | null;
  subject?: Tables<"subjects"> | null;
  class?: Tables<"classes"> | null;
};

interface WeekViewCalendarProps {
  sessions: BaseSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (sessionId: string) => void;
  currentWeekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
  minDate?: Date; // Minimum date (current week start)
}

export function WeekViewCalendar({
  sessions,
  selectedSessionIds,
  onToggleSession,
  currentWeekStart,
  onWeekChange,
  minDate,
}: WeekViewCalendarProps) {
  // Existing callers query local calendar weeks; use that timezone to group sessions.
  return (
    <SessionSelect
      items={sessions}
      value={null}
      onValueChange={() => {}}
      getItemId={(row) => row.id}
      getItemLabel={(row) =>
        row.short_name || row.long_name || row.subject?.name || "Session"
      }
      selectedIds={selectedSessionIds}
      onToggle={(row) => onToggleSession(row.id)}
      weekStart={currentWeekStart}
      timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      onWeekChange={onWeekChange}
      minDate={minDate}
      placeholder="Select sessions"
    />
  );
}
