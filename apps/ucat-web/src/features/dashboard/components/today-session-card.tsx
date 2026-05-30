"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Badge } from "@altitutor/ui";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import {
  getUcatSessionAdelaideDayStatus,
  type StudentUcatSession,
} from "@/features/sessions/api/sessions-api";

const ADELAIDE_TZ = "Australia/Adelaide";

function getEarliestSessionToday(
  sessions: StudentUcatSession[],
): StudentUcatSession | null {
  const todaySessions = sessions.filter(
    (s) => getUcatSessionAdelaideDayStatus(s.start_at) === "today",
  );
  if (todaySessions.length === 0) return null;
  todaySessions.sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
    return aTime - bTime;
  });
  return todaySessions[0] ?? null;
}

function isSessionLive(
  session: StudentUcatSession,
  now: Date,
): boolean {
  if (!session.start_at || !session.end_at) return false;
  const start = new Date(session.start_at).getTime();
  const end = new Date(session.end_at).getTime();
  const t = now.getTime();
  return t >= start && t <= end;
}

function LiveBadge({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <Badge
      variant="destructive"
      className={cn(
        "shrink-0 gap-1.5 border-0 bg-destructive/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        "shadow-sm shadow-destructive/25",
      )}
      aria-label="Session in progress"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {!reduceMotion ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-60" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full bg-destructive-foreground",
            reduceMotion && "animate-pulse",
          )}
        />
      </span>
      Live
    </Badge>
  );
}

export function TodaySessionCard() {
  const reduceMotion = useReducedMotion();
  const { data: sessions, isLoading } = useStudentUcatSessions();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const sessionToday = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    return getEarliestSessionToday(sessions);
  }, [sessions]);

  const live = sessionToday ? isSessionLive(sessionToday, now) : false;

  if (isLoading || !sessionToday) {
    return null;
  }

  const dateLabel = sessionToday.start_at
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: ADELAIDE_TZ,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(sessionToday.start_at))
    : "Date TBC";

  const timeLabel =
    sessionToday.start_at && sessionToday.end_at
      ? new Intl.DateTimeFormat("en-AU", {
          timeZone: ADELAIDE_TZ,
          hour: "numeric",
          minute: "2-digit",
        }).formatRange(
          new Date(sessionToday.start_at),
          new Date(sessionToday.end_at),
        )
      : null;

  return (
    <Link
      href={`/sessions/${encodeURIComponent(sessionToday.session_id)}`}
      className={cn(
        "group block rounded-ucatShell p-6 text-left",
        UCAT_SURFACE_CARD,
        UCAT_SURFACE_MOTION,
        !reduceMotion && "hover:-translate-y-0.5",
        "hover:bg-muted/40 hover:shadow-md hover:ring-black/[0.1] dark:hover:ring-white/[0.12]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-medium leading-none">Today&apos;s session</h2>
        {live ? <LiveBadge reduceMotion={!!reduceMotion} /> : null}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">
            {timeLabel}
            {sessionToday.class_level ? (
              <span className="ml-1">· {sessionToday.class_level}</span>
            ) : null}
          </p>
        </div>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground opacity-60 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100",
          )}
          aria-hidden
        />
      </div>
    </Link>
  );
}
