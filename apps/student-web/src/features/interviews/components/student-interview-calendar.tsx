"use client";

import React, { useState, type ReactNode } from "react";
import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { Calendar, MapPin, Video } from "lucide-react";
import {
  Badge,
  Button,
  SessionInfoGrid,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  InterviewRoundCalendarCard,
  TimedCalendar,
} from "@altitutor/ui";
import { formatSessionDate, formatSessionTimeRangeForDisplay, type StudentInterviewRound } from "@altitutor/shared";
import { studentModalHairline, studentModalShell } from "@/shared/lib/student-visual";
import { cn } from "@/shared/utils";
import { formatTime } from "@/shared/utils/datetime";
import { useStudentSessions } from "@/shared/hooks/useStudentSessions";
import type { StudentSessionWithStaff } from "@/shared/api/sessions";
import { StudentSessionsCard } from "@/features/sessions/components/StudentSessionsCard";
import { StudentInterviewListCard } from "./student-interview-list-card";
import { useInterviewCalendarRounds } from "../hooks/use-interviews";
import { interviewResultsHref, interviewRoomHref } from "../lib/routes";

type Entry =
  | { kind: "round"; round: StudentInterviewRound; start: string; end: string }
  | { kind: "session"; session: StudentSessionWithStaff };

function isMedicineInterviewSession(session: StudentSessionWithStaff) {
  return session.subject_name?.trim().toLowerCase() === "medicine interview";
}

function roundTime(round: StudentInterviewRound) {
  const start = round.startedAt ?? round.scheduledAt;
  return start ? format(new Date(start), "h:mm a") : "Start when your tutor is ready";
}

function roundAction(round: StudentInterviewRound) {
  if (round.phase === "completed") return round.result ? "View results" : "Awaiting results";
  if (round.delivery === "in_person") return "In person";
  return round.startedAt ? "Rejoin interview" : "Enter waiting room";
}

function interviewEnd(round: StudentInterviewRound, start: string) {
  // Older deployments may not yet include the projected end estimate.
  return round.scheduledEndAt ?? new Date(Date.parse(start) + 30 * 60_000).toISOString();
}

export function StudentInterviewCalendar({
  dates,
  sessions,
  onOpenSession,
  interviewsOnly = false,
  calendarControls,
}: {
  dates: Date[];
  sessions: StudentSessionWithStaff[];
  onOpenSession?: (id: string) => void;
  interviewsOnly?: boolean;
  calendarControls?: ReactNode;
}) {
  const query = useInterviewCalendarRounds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const round = query.data?.find((r) => r.id === selectedId);
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const todayQuery = useStudentSessions(todayKey, todayKey, interviewsOnly);
  const todayRounds = interviewsOnly ? (query.data ?? []).filter((item) => {
    const date = item.startedAt ?? item.scheduledAt;
    return date ? isSameDay(new Date(date), today) : item.phase !== "completed";
  }) : [];
  const todaySessions = interviewsOnly ? (todayQuery.data ?? []).filter(isMedicineInterviewSession) : [];
  const calendarRounds = (query.data ?? []).filter((item) => !interviewsOnly || item.phase !== "completed");
  const calendarSessions = interviewsOnly ? sessions.filter(isMedicineInterviewSession) : sessions;
  const events = [
    ...calendarSessions.flatMap((session) =>
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
    ...calendarRounds.flatMap((round) => {
      const start = round.scheduledAt ?? (interviewsOnly ? round.startedAt : null);
      if (!start) return [];
      const end = interviewEnd(round, start);
      return [
        {
          id: `round:${round.id}`,
          startAt: start,
          endAt: end,
          value: { kind: "round" as const, round, start, end },
        },
      ];
    }),
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
      {(todayRounds.length > 0 || todaySessions.length > 0) && (
        <section className="space-y-3" aria-labelledby="today-interviews-heading">
          <h3 id="today-interviews-heading" className="font-semibold">Today</h3>
          {todayRounds.map((item) => {
            const props = {
              icon: item.delivery === "online" ? Video : MapPin,
              title: item.name,
              description: roundTime(item) + " · " + roundAction(item),
            };
            const href = item.phase === "completed" ? item.result && interviewResultsHref(item.id) :
              item.delivery === "online" && interviewRoomHref(item.id);
            return href ? <StudentInterviewListCard key={item.id} {...props} href={href} /> :
              <StudentInterviewListCard key={item.id} {...props} onClick={() => setSelectedId(item.id)} />;
          })}
          {todaySessions.map((session) => {
            const id = session.session_id;
            return id && (
              <StudentInterviewListCard key={id} icon={Calendar} title="Medicine Interview session"
                description={formatSessionTimeRangeForDisplay(session, formatTime)}
                onClick={() => onOpenSession?.(id)} />
            );
          })}
        </section>
      )}
      {todayQuery.isError && interviewsOnly && (
        <p role="status" className="text-sm text-muted-foreground">
          Today’s interview sessions could not be loaded.{" "}
          <button type="button" className="underline" onClick={() => void todayQuery.refetch()}>Retry</button>
        </p>
      )}
      {calendarControls}
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
              tooltipRange={entry}
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
      <Sheet open={!!round} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent className={cn(studentModalShell, "flex h-full max-h-[100dvh] w-full flex-col overflow-hidden rounded-none rounded-l-2xl p-0 md:w-[600px] md:max-w-none [&>button]:rounded-xl [&>button]:hover:bg-muted/80")}>
          {round && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <SheetHeader className="mb-6">
                <SheetTitle>Interview Details</SheetTitle>
                <SheetDescription className="text-lg font-medium">{round.name}</SheetDescription>
              </SheetHeader>
              <InterviewSheetInformation round={round} />
              <div className={cn(studentModalHairline, "my-6")} />
              {round.phase === "completed" ? (
                round.result ? (
                  <Button asChild><Link href={interviewResultsHref(round.id)}>View results</Link></Button>
                ) : <p className="text-sm text-muted-foreground">Awaiting results</p>
              ) : round.delivery === "online" ? (
                <Button asChild><Link href={interviewRoomHref(round.id)}>{roundAction(round)}</Link></Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your tutor will select you when you arrive at their station.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function InterviewSheetInformation({ round }: { round: StudentInterviewRound }) {
  const start = round.scheduledAt ?? round.startedAt;
  const end = start ? interviewEnd(round, start) : null;
  return (
    <section className="space-y-4">
      <h3 className="text-2xl font-semibold">Interview Information</h3>
      <SessionInfoGrid
        day={start ? formatSessionDate(start) : "—"}
        time={formatSessionTimeRangeForDisplay({ start_at: start, end_at: end }, formatTime)}
        timeSubline={round.scheduledAt && <span className="text-xs text-muted-foreground">Estimated duration</span>}
        subjectNode={<Badge variant="secondary">Medicine Interview</Badge>}
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <dt className="font-medium text-muted-foreground">Delivery:</dt>
        <dd>{round.delivery === "online" ? "Online" : "In person"}</dd>
        <dt className="font-medium text-muted-foreground">Stations:</dt>
        <dd>{round.stations.length}</dd>
      </dl>
      {round.phase !== "completed" && (
        <p className="text-sm text-muted-foreground">Your tutors control when the interview starts and finishes.</p>
      )}
    </section>
  );
}
