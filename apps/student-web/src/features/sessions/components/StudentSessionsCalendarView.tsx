"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, endOfWeek, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStudentSessions } from "../hooks/useSessions";
import { StudentInterviewCalendar } from "@/features/interviews/components/student-interview-calendar";
import { SessionModal } from "./SessionModal";
import { Button } from "@altitutor/ui";
import { studentBtnOutline } from "@/shared/lib/student-visual";

type StudentSessionsCalendarViewProps = {
  linkedSessionId?: string | null;
  onLinkedSessionHandled?: () => void;
};

export function StudentSessionsCalendarView({
  linkedSessionId = null,
  onLinkedSessionHandled,
}: StudentSessionsCalendarViewProps = {}) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!linkedSessionId) return;
    setSelectedSessionId(linkedSessionId);
    setIsModalOpen(true);
    onLinkedSessionHandled?.();
  }, [linkedSessionId, onLinkedSessionHandled]);
  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const weekEnd = useMemo(
    () => endOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );

  const { data: sessions } = useStudentSessions(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className={studentBtnOutline}
          aria-label="Previous week"
          onClick={() => setAnchor(addDays(anchor, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className={studentBtnOutline}
          onClick={() => setAnchor(new Date())}
        >
          Today
        </Button>
        <Button
          variant="outline"
          className={studentBtnOutline}
          aria-label="Next week"
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <StudentInterviewCalendar
        dates={days}
        sessions={sessions ?? []}
        onOpenSession={(id) => {
          setSelectedSessionId(id);
          setIsModalOpen(true);
        }}
      />
      {isModalOpen && selectedSessionId && (
        <SessionModal
          sessionId={selectedSessionId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSessionId(null);
          }}
        />
      )}
    </div>
  );
}
