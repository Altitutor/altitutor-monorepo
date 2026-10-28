"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  InterviewRoundCalendarCard,
  TimedCalendar,
} from "@altitutor/ui";
import type { StudentInterviewRound } from "@altitutor/shared";
import type { StudentSessionWithStaff } from "@/shared/api/sessions";
import { StudentSessionsCard } from "@/features/sessions/components/StudentSessionsCard";
import { useInterviewCalendarRounds } from "../hooks/use-interviews";
import { interviewResultsHref, interviewRoomHref } from "../lib/routes";

type Entry =
  | { kind: "round"; round: StudentInterviewRound }
  | { kind: "session"; session: StudentSessionWithStaff };

export function StudentInterviewCalendar({
  dates,
  sessions,
  onOpenSession,
}: {
  dates: Date[];
  sessions: StudentSessionWithStaff[];
  onOpenSession?: (id: string) => void;
}) {
  const query = useInterviewCalendarRounds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const round = query.data?.find((r) => r.id === selectedId);
  const events = [
    ...sessions.flatMap((session) =>
      session.start_at && session.end_at
        ? [
            {
              id: `session:${session.session_id}`,
              startAt: session.start_at,
              endAt: session.end_at,
              value: { kind: "session" as const, session },
            },
          ]
        : [],
    ),
    ...(query.data ?? []).flatMap((r) =>
      r.scheduledAt
        ? [
            {
              id: `round:${r.id}`,
              startAt: r.scheduledAt,
              // Older deployments may not yet include the additive projected end estimate.
              endAt:
                r.scheduledEndAt ??
                new Date(Date.parse(r.scheduledAt) + 30 * 60_000).toISOString(),
              value: { kind: "round" as const, round: r },
            },
          ]
        : [],
    ),
  ];
  const hasVisibleEvents = dates.some((date) => {
    const start = new Date(date).setHours(0, 0, 0, 0);
    const end = new Date(date).setHours(24, 0, 0, 0);
    return events.some(
      (event) =>
        Date.parse(event.startAt) < end && Date.parse(event.endAt) > start,
    );
  });
  if (
    dates.length === 1 &&
    !hasVisibleEvents &&
    !query.isPending &&
    !query.isError
  )
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sessions scheduled for today.
      </p>
    );
  return (
    <>
      {query.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          Interview rounds could not be loaded.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      <TimedCalendar<Entry>
        dates={dates}
        events={events}
        renderEvent={(entry, size) =>
          entry.kind === "round" ? (
            <InterviewRoundCalendarCard
              name={entry.round.name}
              start={entry.round.scheduledAt!}
              onClick={() => setSelectedId(entry.round.id)}
            />
          ) : (
            <StudentSessionsCard
              session={entry.session}
              staff={entry.session.staff}
              students={entry.session.students}
              isCalendarView
              cardHeight={size.height}
              cardWidth={size.width}
              isExtra={entry.session.class_id === null}
              isNotAttending={entry.session.planned_absence === true}
              onClick={() => {
                if (entry.session.session_id)
                  onOpenSession?.(entry.session.session_id);
              }}
            />
          )
        }
      />
      <Dialog
        open={!!round}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent>
          {round && (
            <>
              <DialogHeader>
                <DialogTitle>{round.name}</DialogTitle>
                <DialogDescription>Interview round</DialogDescription>
              </DialogHeader>
              <p className="text-sm">
                {round.scheduledAt &&
                  format(
                    new Date(round.scheduledAt),
                    "EEE d MMM · h:mm a",
                  )}{" "}
                · {round.delivery === "online" ? "Online" : "In person"} ·{" "}
                {round.stations.length} stations
              </p>
              <p className="text-sm text-muted-foreground">
                Calendar duration is estimated. Your tutors control when the
                interview starts and finishes.
              </p>
              {round.phase === "completed" ? (
                round.result ? (
                  <Button asChild>
                    <Link href={interviewResultsHref(round.id)}>
                      View results
                    </Link>
                  </Button>
                ) : (
                  <p>Awaiting results</p>
                )
              ) : round.delivery === "online" ? (
                <Button asChild>
                  <Link href={interviewRoomHref(round.id)}>
                    {round.startedAt
                      ? "Rejoin interview"
                      : "Enter waiting room"}
                  </Link>
                </Button>
              ) : (
                <p>
                  Your tutor will select you when you arrive at their station.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
