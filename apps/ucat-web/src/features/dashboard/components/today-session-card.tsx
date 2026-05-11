"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_INTERACTION_EASE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";

const ADELAIDE_TZ = "Australia/Adelaide";

function getAdelaideDayStatus(
  startAtIso: string | null | undefined,
): "past" | "today" | "future" {
  if (!startAtIso) return "future";
  const now = new Date();
  const todayParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: ADELAIDE_TZ,
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
    timeZone: ADELAIDE_TZ,
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

function getEarliestSessionToday(
  sessions: StudentUcatSession[],
): StudentUcatSession | null {
  const todaySessions = sessions.filter(
    (s) => getAdelaideDayStatus(s.start_at) === "today",
  );
  if (todaySessions.length === 0) return null;
  todaySessions.sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
    return aTime - bTime;
  });
  return todaySessions[0] ?? null;
}

export function TodaySessionCard() {
  const { data: classesWithSessions, isLoading } = useStudentUcatSessions();

  const sessionToday = useMemo(() => {
    if (!classesWithSessions || classesWithSessions.length === 0) return null;
    const allSessions = classesWithSessions.flatMap((c) => c.sessions);
    return getEarliestSessionToday(allSessions);
  }, [classesWithSessions]);

  const classInfo = useMemo(() => {
    if (!sessionToday || !classesWithSessions) return null;
    return classesWithSessions.find(
      (c) => c.class_id === sessionToday.class_id,
    );
  }, [sessionToday, classesWithSessions]);

  if (isLoading || !sessionToday) {
    return null;
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Today&apos;s session
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link
          href={`/sessions/${encodeURIComponent(sessionToday.session_id)}`}
          className={cn(
            "group flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4",
            "transition-[box-shadow,background-color,border-color] duration-200",
            UCAT_INTERACTION_EASE,
            "hover:border-border/80 hover:bg-muted/50 hover:shadow-sm",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {sessionToday.start_at
                ? new Intl.DateTimeFormat("en-AU", {
                    timeZone: ADELAIDE_TZ,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(sessionToday.start_at))
                : "Date TBC"}
            </p>
            <p className="text-xs text-muted-foreground">
              {sessionToday.start_at && sessionToday.end_at
                ? new Intl.DateTimeFormat("en-AU", {
                    timeZone: ADELAIDE_TZ,
                    hour: "numeric",
                    minute: "2-digit",
                  }).formatRange(
                    new Date(sessionToday.start_at),
                    new Date(sessionToday.end_at),
                  )
                : null}
              {classInfo?.class_level ? (
                <span className="ml-1">· {classInfo.class_level}</span>
              ) : null}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 translate-x-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
