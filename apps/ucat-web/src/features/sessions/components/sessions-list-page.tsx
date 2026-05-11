"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronRight, Clock, Users } from "lucide-react";
import { Badge, Card, CardContent, useToast } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_RAISED_HOVER,
  UCAT_INTERACTION_EASE,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import {
  getUcatSessionAdelaideDayStatus,
  type StudentUcatSession,
} from "@/features/sessions/api/sessions-api";

const ADELAIDE_TZ = "Australia/Adelaide";

function sessionStudentCount(session: StudentUcatSession): number | null {
  const { students } = session;
  if (!students || !Array.isArray(students)) return null;
  return students.length;
}

function SessionCard({
  session,
  reduceMotion,
  onBlockedNavigate,
}: {
  session: StudentUcatSession;
  reduceMotion: boolean;
  onBlockedNavigate: (reason: "upcoming" | "absent" | "unavailable") => void;
}) {
  const status = getUcatSessionAdelaideDayStatus(session.start_at);
  const isFutureDay = status === "future";
  const isToday = status === "today";
  const isAbsentLogged = session.tutor_log_marked_absent === true;

  const href = session.session_id
    ? `/sessions/${encodeURIComponent(session.session_id)}`
    : "#";

  const canNavigate =
    !!session.session_id && !isFutureDay && !isAbsentLogged;

  const dateLabel = session.start_at
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: ADELAIDE_TZ,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(session.start_at))
    : "Date TBC";

  const timeLabel =
    session.start_at && session.end_at
      ? `${new Intl.DateTimeFormat("en-AU", {
          timeZone: ADELAIDE_TZ,
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(session.start_at))} – ${new Intl.DateTimeFormat(
          "en-AU",
          {
            timeZone: ADELAIDE_TZ,
            hour: "numeric",
            minute: "2-digit",
          },
        ).format(new Date(session.end_at))}`
      : null;

  const room = session.room?.trim() || null;
  const studentCount = sessionStudentCount(session);
  const showRightMeta = Boolean(room || studentCount != null);

  const handleBlockedClick = () => {
    if (!session.session_id) {
      onBlockedNavigate("unavailable");
      return;
    }
    if (isAbsentLogged) {
      onBlockedNavigate("absent");
      return;
    }
    if (isFutureDay) {
      onBlockedNavigate("upcoming");
    }
  };

  const cardClassName = cn(
    UCAT_CARD_CHROME,
    canNavigate && UCAT_CARD_RAISED_HOVER,
    canNavigate && !reduceMotion && "hover:-translate-y-0.5",
    isToday && canNavigate && "ring-1 ring-primary/20",
    isFutureDay && "opacity-[0.55]",
  );

  const cardInner = (
    <Card className={cardClassName}>
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-ucatControl",
            isToday
              ? "bg-sidebar text-sidebar-foreground"
              : isFutureDay
                ? "bg-muted/80 text-muted-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          <CalendarDays className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium leading-tight">{dateLabel}</p>
            {isToday ? (
              <Badge
                variant="secondary"
                className="h-5 shrink-0 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide"
              >
                Today
              </Badge>
            ) : null}
            {isAbsentLogged ? (
              <Badge
                variant="outline"
                className="h-5 shrink-0 border-destructive/40 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-destructive"
              >
                Absent
              </Badge>
            ) : null}
          </div>
          {timeLabel ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{timeLabel}</p>
          ) : null}
        </div>

        {showRightMeta ? (
          <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-right text-xs text-muted-foreground sm:text-sm">
            {room ? (
              <span className="inline-flex max-w-[10rem] items-center justify-end gap-1 sm:max-w-[14rem]">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{room}</span>
              </span>
            ) : null}
            {studentCount != null ? (
              <span className="inline-flex items-center justify-end gap-1">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{studentCount}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {canNavigate ? (
          <ChevronRight
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground opacity-60 transition-transform duration-200",
              UCAT_INTERACTION_EASE,
              "group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100",
            )}
            aria-hidden
          />
        ) : null}
      </CardContent>
    </Card>
  );

  if (canNavigate) {
    return (
      <Link
        href={href}
        className={cn(
          "group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
        )}
      >
        {cardInner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35"
      onClick={handleBlockedClick}
    >
      {cardInner}
    </button>
  );
}

export function SessionsListPage() {
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const { data: sessions, isLoading, error } = useStudentUcatSessions();

  const onBlockedNavigate = useCallback(
    (reason: "upcoming" | "absent" | "unavailable") => {
      toast({
        description:
          reason === "upcoming"
            ? "Session resources open after this class has taken place."
            : reason === "absent"
              ? "This session is unavailable because you were marked absent. Please contact us if that is incorrect."
              : "This session cannot be opened right now.",
      });
    },
    [toast],
  );

  const listVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.04,
          delayChildren: reduceMotion ? 0 : 0.03,
        },
      },
    }),
    [reduceMotion],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.2,
          ease: [0.32, 0.72, 0, 1] as const,
        },
      },
    }),
    [reduceMotion],
  );

  const headerDescription =
    "Your UCAT classes in date order. Open a session after it has run to see linked resources.";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Sessions"
          description={headerDescription}
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
          description={headerDescription}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load sessions"}
        </p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Sessions"
          description={headerDescription}
        />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any UCAT sessions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader title="Sessions" description={headerDescription} />
      <motion.div
        className="flex flex-col gap-3"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {sessions.map((session) => (
          <motion.div
            key={`${session.session_id}-${session.session_student_id ?? "s"}`}
            variants={itemVariants}
          >
            <SessionCard
              session={session}
              reduceMotion={!!reduceMotion}
              onBlockedNavigate={onBlockedNavigate}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
