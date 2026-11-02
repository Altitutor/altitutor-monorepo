"use client";

import { parseISO } from "date-fns";
import type { StudentSessionWithStaff } from "@/shared/api/sessions";
import { StudentInterviewCalendar } from "@/features/interviews/components/student-interview-calendar";

export function StudentTodaySessionsCalendarView({
  date,
  sessions,
  isLoading,
  onOpenSession,
}: {
  date: string;
  sessions: StudentSessionWithStaff[];
  isLoading?: boolean;
  onOpenSession?: (id: string) => void;
}) {
  if (isLoading)
    return (
      <p
        role="status"
        className="py-8 text-center text-sm text-muted-foreground"
      >
        Loading today’s sessions…
      </p>
    );
  return (
    <StudentInterviewCalendar
      dates={[parseISO(date)]}
      sessions={sessions}
      onOpenSession={onOpenSession}
    />
  );
}
