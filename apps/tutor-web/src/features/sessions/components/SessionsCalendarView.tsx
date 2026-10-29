"use client";

import { useMemo, useState } from "react";
import { addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, TimedCalendar } from "@altitutor/ui";
import type { Database } from "@altitutor/shared";
import {
  useSessions,
  useTutorSessionDetailsBatch,
} from "../hooks/useSessionsQuery";
import { useInterviewCalendarRounds } from "@/features/interviews/hooks/use-interviews";
import {
  toScheduledRound,
  type ScheduledInterviewRound,
} from "@/features/interviews/lib/round-calendar";
import {
  InterviewRoundCalendarCard,
  InterviewRoundInfoDialog,
} from "@/features/interviews/components/InterviewRoundInfoDialog";
import { SessionCard } from "./SessionCard";

type Session = Database["public"]["Views"]["vtutor_sessions"]["Row"];
type Entry =
  | { kind: "session"; session: Session & { session_id: string } }
  | { kind: "round"; round: ScheduledInterviewRound };

export function SessionsCalendarView({
  onOpenSession,
}: {
  onOpenSession?: (id: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [roundId, setRoundId] = useState<string | null>(null);
  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { data: sessions = [] } = useSessions();
  const roundsQuery = useInterviewCalendarRounds();
  const rounds = (roundsQuery.data ?? []).flatMap((r) => {
    const round = toScheduledRound(r, "");
    return round ? [round] : [];
  });
  const { data: details = {} } = useTutorSessionDetailsBatch(
    sessions.flatMap((s) => (s.session_id ? [s.session_id] : [])),
  );
  const events = [
    ...sessions.flatMap((session) =>
      session.session_id && session.start_at && session.end_at
        ? [
            {
              id: `session:${session.session_id}`,
              startAt: session.start_at,
              endAt: session.end_at,
              value: {
                kind: "session" as const,
                session: { ...session, session_id: session.session_id },
              },
            },
          ]
        : [],
    ),
    ...rounds.map((round) => ({
      id: `round:${round.id}`,
      startAt: round.scheduledAt,
      endAt: round.endAt,
      value: { kind: "round" as const, round },
    })),
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          aria-label="Previous week"
          onClick={() => setAnchor(addDays(anchor, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <Button
          variant="outline"
          aria-label="Next week"
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {roundsQuery.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          Interview rounds could not be loaded.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void roundsQuery.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      <TimedCalendar<Entry>
        dates={dates}
        events={events}
        renderEvent={(entry, size) => {
          if (entry.kind === "round")
            return (
              <InterviewRoundCalendarCard
                name={entry.round.name}
                start={entry.round.scheduledAt}
                onClick={() => setRoundId(entry.round.id)}
              />
            );
          const session = entry.session;
          const detail = details[session.session_id];
          return (
            <SessionCard
              session={{ ...session, session_type: session.session_type ?? "" }}
              staff={detail?.staff}
              students={(detail?.students ?? []).map((student) => ({
                ...student,
                year_level: student.year_level ?? undefined,
              }))}
              onClick={() => onOpenSession?.(session.session_id)}
              isCalendarView
              cardHeight={size.height}
              cardWidth={size.width}
            />
          );
        }}
      />
      <InterviewRoundInfoDialog
        round={rounds.find((r) => r.id === roundId) ?? null}
        onClose={() => setRoundId(null)}
        waitingLabel="Open waiting room"
      />
    </div>
  );
}
