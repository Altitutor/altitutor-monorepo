"use client";

import { reportInterviewCallFailure } from "@/lib/sentry/interview-call-reporting";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Maximize2, Minimize2, Wifi, WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  InterviewMedia,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import type { StudentInterviewRound } from "@altitutor/shared";
import {
  studentBtnIconOutline,
  studentCardCn,
} from "@/shared/lib/student-visual";
import { cn } from "@/shared/utils";
import { useInterviewRound } from "../hooks/use-interviews";
import { useInterviewLeaveGuard } from "../hooks/use-interview-leave-guard";
import {
  readingClock,
  studentInfoCard,
  studentPhaseMessage,
  studentWaitingSeconds,
  studentReadingSeconds,
  studentShowsReadingClock,
  studentStageBadge,
} from "../lib/presentation";
import { interviewResultsHref } from "../lib/routes";
import { InterviewContent } from "./interview-content";
import { InterviewError } from "./interview-error";

function useBrowserOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

function FullscreenButton() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={studentBtnIconOutline}
      aria-label={active ? "Exit fullscreen" : "Full screen"}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void document.documentElement
            .requestFullscreen()
            .catch(() => undefined);
      }}
    >
      {active ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
    </Button>
  );
}

function ConnectionStatus({
  status,
}: {
  status: "online" | "offline" | "reconnecting";
}) {
  const label =
    status === "online"
      ? "Online"
      : status === "offline"
        ? "Offline"
        : "Reconnecting";
  const Icon = status === "offline" ? WifiOff : Wifi;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            status === "online"
              ? "text-emerald-600 dark:text-emerald-400"
              : status === "offline"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-700 dark:text-amber-300",
          )}
          aria-label={`You are ${label.toLowerCase()}`}
        >
          <Icon
            className={cn("h-4 w-4", status !== "online" && "animate-pulse")}
          />
          <span>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {status === "online"
          ? "You are online"
          : status === "offline"
            ? "You are offline"
            : "Connection interrupted. Reconnecting."}
      </TooltipContent>
    </Tooltip>
  );
}

function OnlineInterviewRoom({
  round,
  seconds,
  status,
  onExit,
  waitingSeconds,
}: {
  round: StudentInterviewRound;
  seconds: number | null;
  status: "online" | "offline" | "reconnecting";
  onExit: () => void;
  waitingSeconds: number | null;
}) {
  const stage = studentStageBadge(round);
  const info = studentInfoCard(round);
  const showClock = studentShowsReadingClock(round) && seconds !== null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-dvh min-h-0 flex-col bg-background">
        <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur">
          <div className="grid items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-5">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="min-w-0 truncate font-semibold">{round.name}</h1>
              <ConnectionStatus status={status} />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              {round.pausedAt && (
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Paused
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {round.mode === "exam" ? "Exam mode" : "Feedback mode"}
                </span>
                <p
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    stage.pill,
                  )}
                >
                  {stage.label}
                </p>
                {showClock && (
                  <p
                    role="timer"
                    aria-label="Reading time remaining"
                    className="font-mono text-2xl tabular-nums leading-none"
                  >
                    {readingClock(seconds)}
                  </p>
                )}
                {waitingSeconds !== null && (
                  <p
                    role="timer"
                    aria-label="Waiting time elapsed"
                    className="font-mono text-sm tabular-nums"
                  >
                    {readingClock(waitingSeconds)}
                  </p>
                )}
                <p className="text-xs font-medium">
                  Rotation {round.rotation + 1}/{round.stations.length}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <FullscreenButton />
              <Button variant="destructive" onClick={onExit}>
                Exit
              </Button>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-4 md:p-5">
          <div
            className={cn(
              "mx-auto grid h-full max-w-7xl min-h-0 items-start gap-4",
              round.phase !== "completed"
                ? "grid-rows-[auto_minmax(0,1fr)] md:grid-cols-2 md:grid-rows-1"
                : "grid-rows-1",
            )}
          >
            {round.phase !== "completed" && (
              <aside className="max-h-[34svh] min-w-0 space-y-4 overflow-y-auto md:max-h-full">
                {round.delivery === "in_person" && (
                  <section className={studentCardCn("space-y-4 p-5")}>
                    <h2 className="font-semibold">Your station</h2>
                    <p className="text-sm text-muted-foreground">
                      {round.tutor
                        ? `Tutor: ${round.tutor.name}`
                        : "Your tutor selects you when you arrive."}
                    </p>
                    <div
                      className="flex flex-wrap gap-2"
                      aria-label="Interview stations"
                    >
                      {round.stations.map((station) => (
                        <span
                          key={station.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs",
                            station.id === round.stationId &&
                              "bg-muted font-medium",
                          )}
                        >
                          {station.complete && <Check className="h-3 w-3" />}
                          Station {station.number}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                <InterviewMedia
                  onCallFailure={reportInterviewCallFailure}
                  className="mx-auto w-full max-w-[min(100%,34svh)] md:max-w-[min(100%,74dvh)]"
                  roundId={round.id}
                  phase={round.phase}
                  delivery={round.delivery}
                  enabled={
                    !round.pausedAt &&
                    !(round.endedEarly && round.mode === "exam")
                  }
                />
              </aside>
            )}
            <div className="h-full min-h-0 min-w-0 space-y-4 overflow-y-auto">
              {round.phase !== "completed" && (
                <p className="rounded-xl bg-blue-100 px-4 py-3 text-sm font-medium text-blue-950 dark:bg-blue-950 dark:text-blue-100">
                  {studentPhaseMessage(round)}
                </p>
              )}

              <section className={studentCardCn("space-y-3 p-5 md:p-6")}>
                {round.pausedAt && (
                  <p className="text-sm text-muted-foreground">
                    Your tutor has paused the interview. Stay here until it
                    resumes.
                  </p>
                )}
                <h2 className="text-xl font-semibold">{info.title}</h2>
                {info.variant === "prompt" ? (
                  <InterviewContent value={round.prompt} />
                ) : (
                  <p className="text-muted-foreground">{info.body}</p>
                )}
                {info.variant === "instructions" &&
                  round.phase === "waiting" &&
                  round.scheduledAt && (
                    <p className="text-sm">
                      Scheduled for{" "}
                      {new Date(round.scheduledAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      . Your tutor starts the round.
                    </p>
                  )}
                {round.phase === "completed" && (
                  <Button asChild variant="outline">
                    <Link
                      href={
                        round.result
                          ? interviewResultsHref(round.id)
                          : "/interviews"
                      }
                    >
                      {round.result ? "View results" : "Return to interviews"}
                    </Link>
                  </Button>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export function StudentInterviewRoom({ roundId }: { roundId: string }) {
  const query = useInterviewRound(roundId, true);
  const round = query.data;
  const guard = useInterviewLeaveGuard(round?.phase !== "completed");
  const browserOnline = useBrowserOnline();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const synchronizedAt = Date.now();
    const serverTime = round?.serverNow
      ? Date.parse(round.serverNow)
      : synchronizedAt;
    const update = () => setNow(serverTime + Date.now() - synchronizedAt);
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [round?.serverNow]);
  const seconds = round ? studentReadingSeconds(round, now) : null;
  const connectionStatus = !browserOnline
    ? "offline"
    : query.heartbeatFailed
      ? "reconnecting"
      : "online";
  if (round && !query.error)
    return (
      <>
        <OnlineInterviewRoom
          round={round}
          seconds={seconds}
          status={connectionStatus}
          onExit={guard.requestExit}
          waitingSeconds={studentWaitingSeconds(round, now)}
        />
        <AlertDialog
          open={guard.open}
          onOpenChange={(open) => {
            if (!open) guard.cancelExit();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this interview?</AlertDialogTitle>
              <AlertDialogDescription>
                The interview will continue. You can rejoin from Interviews or
                your notification.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay in interview</AlertDialogCancel>
              <AlertDialogAction onClick={guard.confirmExit}>
                Leave interview
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  return (
    <main className="p-6">
      {query.isPending ? (
        <p role="status">Connecting to your interview…</p>
      ) : (
        <InterviewError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
    </main>
  );
}
