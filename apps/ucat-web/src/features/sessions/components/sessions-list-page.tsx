"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, useToast } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { cn } from "@/lib/utils";
import { sessionCardIconChipClassName } from "@/features/sessions/lib/session-card-icon-chip";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import {
  getUcatSessionAdelaideDayStatus,
  type StudentUcatSession,
} from "@/features/sessions/api/sessions-api";
import {
  UcatClickableCardContent,
} from "@/shared/components/ucat-clickable-card";
import { ucatClickableCardClassName } from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const ADELAIDE_TZ = "Australia/Adelaide";

function SessionCard({
  session,
  onBlockedNavigate,
}: {
  session: StudentUcatSession;
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

  const surfaceClassName = cn(
    ucatClickableCardClassName({ interactive: canNavigate }),
    isToday && canNavigate && "ring-1 ring-primary/20",
    isFutureDay && "opacity-[0.55]",
  );

  const iconVariant = isToday && canNavigate
    ? "today"
    : isFutureDay
      ? "future"
      : "default";

  const cardContent = (
    <UcatClickableCardContent
      layout="inline"
      iconNode={
        <div className={sessionCardIconChipClassName(iconVariant)}>
          <CalendarDays className="h-5 w-5" aria-hidden />
        </div>
      }
      title={dateLabel}
      titleAddon={
        <>
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
        </>
      }
      description={timeLabel}
      showChevron={canNavigate}
    />
  );

  if (canNavigate) {
    return (
      <Link href={href} className={surfaceClassName}>
        {cardContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(surfaceClassName, "w-full cursor-pointer text-left")}
      onClick={handleBlockedClick}
    >
      {cardContent}
    </button>
  );
}

export function SessionsListPage() {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const { toast } = useToast();
  const { data: sessions, isLoading, error } = useStudentUcatSessions();
  const [showPreviousSessions, setShowPreviousSessions] = useState(false);

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

  const headerDescription =
    "Your UCAT classes in date order. Open a session after it has run to see linked resources.";

  const { hasPastSessions, visibleSessions } = useMemo(() => {
    if (!sessions?.length) {
      return { hasPastSessions: false, visibleSessions: [] as StudentUcatSession[] };
    }
    let hasPast = false;
    const withStatus = sessions.map((s) => {
      const dayStatus = getUcatSessionAdelaideDayStatus(s.start_at);
      if (dayStatus === "past") hasPast = true;
      return { session: s, dayStatus };
    });
    const visible = showPreviousSessions
      ? sessions
      : withStatus
          .filter(({ dayStatus }) => dayStatus !== "past")
          .map(({ session }) => session);
    return { hasPastSessions: hasPast, visibleSessions: visible };
  }, [sessions, showPreviousSessions]);

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
      {hasPastSessions ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreviousSessions((v) => !v)}
          >
            {showPreviousSessions
              ? "Hide previous sessions"
              : "Show previous sessions"}
          </Button>
        </div>
      ) : null}
      {visibleSessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasPastSessions
            ? "No current or upcoming sessions. Show previous sessions to see past classes."
            : "No sessions to display."}
        </p>
      ) : (
        <motion.div
          className="flex flex-col gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {visibleSessions.map((session) => (
            <motion.div
              key={`${session.session_id}-${session.session_student_id ?? "s"}`}
              variants={itemVariants}
            >
              <SessionCard
                session={session}
                onBlockedNavigate={onBlockedNavigate}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
