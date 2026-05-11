"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock, Users } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { UCAT_INTERACTION_EASE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";

const MAX_SESSIONS_VISIBLE = 5;

function getAdelaideDayStatus(
  startAtIso: string | null | undefined,
): "past" | "today" | "future" {
  if (!startAtIso) return "future";

  const adelaideTz = "Australia/Adelaide";
  const now = new Date();

  const todayParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: adelaideTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const startDate = new Date(startAtIso);
  const startParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: adelaideTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(startDate)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const startKey = `${startParts.year}-${startParts.month}-${startParts.day}`;

  if (startKey === todayKey) return "today";
  if (startKey < todayKey) return "past";
  return "future";
}

function filterSessionsToTodayAndPast(
  sessions: StudentUcatSession[],
): StudentUcatSession[] {
  return sessions.filter((s) => {
    const status = getAdelaideDayStatus(s.start_at);
    return status === "today" || status === "past";
  });
}

function SessionListItem({ session }: { session: StudentUcatSession }) {
  const status = getAdelaideDayStatus(session.start_at);
  const isPast = status === "past";
  const isToday = status === "today";

  const baseClasses =
    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-[color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const variantClasses = isToday
    ? "bg-sidebar/80 text-sidebar-foreground"
    : isPast
      ? "bg-muted/60 text-muted-foreground"
      : "bg-card text-card-foreground hover:bg-muted";

  const href = session.session_id
    ? `/sessions/${encodeURIComponent(session.session_id as string)}`
    : "#";

  const dateLabel = session.start_at
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Adelaide",
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(session.start_at))
    : "Date TBC";

  const timeLabel =
    session.start_at && session.end_at
      ? `${new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Adelaide",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(session.start_at))} - ${new Intl.DateTimeFormat(
          "en-AU",
          {
            timeZone: "Australia/Adelaide",
            hour: "numeric",
            minute: "2-digit",
          },
        ).format(new Date(session.end_at))}`
      : null;

  return (
    <li>
      <Link href={href} className={`${baseClasses} ${variantClasses}`}>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {dateLabel}
              {isToday ? (
                <span className="ml-2 rounded bg-background px-1 text-xs font-semibold">
                  Today
                </span>
              ) : null}
            </p>
            {timeLabel ? (
              <p className="text-xs opacity-80">{timeLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {session.room ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{session.room}</span>
            </span>
          ) : null}
          {session.students ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {Array.isArray(session.students)
                  ? session.students.length
                  : "Classmates"}
              </span>
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function ClassCard({
  classId,
  subjectName,
  sessions,
}: {
  classId: string;
  subjectName: string;
  sessions: StudentUcatSession[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = expanded ? sessions.length : MAX_SESSIONS_VISIBLE;
  const visibleSessions = sessions.slice(0, visibleCount);
  const hasMore = sessions.length > MAX_SESSIONS_VISIBLE;
  const hiddenCount = sessions.length - MAX_SESSIONS_VISIBLE;

  return (
    <section key={classId} className="space-y-3">
      <h2 className="text-sm font-semibold leading-tight">{subjectName}</h2>
      <div
        className={cn(
          "rounded-xl bg-card p-4 text-card-foreground shadow-sm",
          "transition-shadow duration-200",
          UCAT_INTERACTION_EASE,
        )}
      >
        <ul className="space-y-2">
          {visibleSessions.map((session) => (
            <SessionListItem key={session.session_id} session={session} />
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground transition-[color,background-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
            {expanded ? "Show less" : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>
    </section>
  );
}

export function SessionsListPage() {
  const { data, isLoading, error } = useStudentUcatSessions();

  const grouped = useMemo(() => {
    const raw = data ?? [];
    return raw.map((cls) => ({
      ...cls,
      sessions: filterSessionsToTodayAndPast(cls.sessions),
    }));
  }, [data]);

  const visibleClasses = useMemo(
    () => grouped.filter((cls) => cls.sessions.length > 0),
    [grouped],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Sessions"
          description="Your upcoming and past UCAT class sessions."
        />
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Sessions"
          description="Your upcoming and past UCAT class sessions."
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load sessions"}
        </p>
      </div>
    );
  }

  if (visibleClasses.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Sessions"
          description="Your upcoming and past UCAT class sessions."
        />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any UCAT sessions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Sessions"
        description="View your UCAT classes and sessions."
      />
      {visibleClasses.map((cls) => (
        <ClassCard
          key={cls.class_id}
          classId={cls.class_id}
          subjectName={cls.subject_name}
          sessions={cls.sessions}
        />
      ))}
    </div>
  );
}
