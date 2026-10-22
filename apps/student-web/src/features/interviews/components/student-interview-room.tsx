"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Check,
  LogOut,
  Maximize,
  Pause,
} from "lucide-react";
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
  Badge,
  Button,
} from "@altitutor/ui";
import { useInterviewRound } from "../hooks/use-interviews";
import { useInterviewLeaveGuard } from "../hooks/use-interview-leave-guard";
import {
  readingClock,
  studentPhaseMessage,
  studentReadingSeconds,
} from "../lib/presentation";
import { interviewResultsHref } from "../lib/routes";
import { InterviewContent } from "./interview-content";
import { InterviewError } from "./interview-error";

export function StudentInterviewRoom({ roundId }: { roundId: string }) {
  const query = useInterviewRound(roundId, true);
  const round = query.data;
  const guard = useInterviewLeaveGuard(round?.phase !== "completed");
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [fullscreenError, setFullscreenError] = useState("");
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
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError(
        "Your browser could not enter fullscreen. You can continue in this window.",
      );
    }
  };
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-card">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="text-sm text-muted-foreground">Medicine interviews</p>
            <h1 className="font-semibold">{round?.name ?? "Interview"}</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={toolbarOpen ? "Collapse toolbar" : "Expand toolbar"}
            onClick={() => setToolbarOpen(!toolbarOpen)}
          >
            {toolbarOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {toolbarOpen && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {round?.delivery === "in_person" ? "In person" : "Online"}
              </Badge>
              {round?.pausedAt && (
                <Badge variant="secondary">
                  <Pause className="mr-1 h-3 w-3" />
                  Paused
                </Badge>
              )}
              {round?.recordingEnabled && (
                <span className="text-xs text-muted-foreground">
                  Recording enabled for this interview
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void enterFullscreen();
                }}
              >
                <Maximize className="mr-2 h-4 w-4" />
                Fullscreen
              </Button>
              <Button variant="outline" size="sm" onClick={guard.requestExit}>
                <LogOut className="mr-2 h-4 w-4" />
                Exit
              </Button>
            </div>
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-5 md:p-8">
        {query.isPending ? (
          <p role="status">Connecting to your interview…</p>
        ) : query.error ? (
          <InterviewError
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : (
          round && (
            <div className="mx-auto max-w-6xl space-y-6">
              {fullscreenError && (
                <p role="status" className="text-sm text-muted-foreground">
                  {fullscreenError}
                </p>
              )}
              {query.heartbeatFailed && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                  Connection interrupted. Reconnecting automatically; the
                  interview continues. Keep this page open.
                </div>
              )}
              <div
                className="flex flex-wrap gap-2"
                aria-label="Interview stations"
              >
                {round.stations.map((station) => (
                  <div
                    key={station.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${station.id === round.stationId ? "bg-muted font-medium" : "text-muted-foreground"}`}
                  >
                    {station.complete && <Check className="h-4 w-4" />}Station{" "}
                    {station.number}
                  </div>
                ))}
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
                <section className="space-y-5 rounded-xl border bg-card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {round.phase === "waiting"
                          ? "Waiting room"
                          : round.phase === "completed"
                            ? "Finished"
                            : round.stationNumber
                              ? `Station ${round.stationNumber}`
                              : "Between stations"}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">
                        {round.pausedAt
                          ? "Interview paused"
                          : round.endedEarly
                            ? "Station complete"
                            : round.phase === "reading"
                              ? "Reading time"
                              : round.phase === "questions"
                                ? "Question time"
                                : round.phase === "feedback"
                                  ? round.mode === "exam"
                                    ? "Please wait"
                                    : "Feedback"
                                  : round.phase === "completed"
                                    ? "Well done"
                                    : "Ready when you are"}
                      </h2>
                    </div>
                    {seconds !== null && (
                      <div className="rounded-lg border bg-muted px-4 py-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          Reading time
                        </p>
                        <p
                          role="timer"
                          aria-label="Reading time remaining"
                          className="text-2xl font-semibold tabular-nums"
                        >
                          {readingClock(seconds)}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {studentPhaseMessage(round)}
                  </p>
                  {round.phase === "waiting" && round.scheduledAt && (
                    <p className="text-sm">
                      Scheduled for{" "}
                      {new Date(round.scheduledAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      . Your tutor starts the round.
                    </p>
                  )}
                  {round.stationId &&
                    !round.endedEarly &&
                    (round.phase === "reading" ||
                      round.phase === "questions") && (
                      <div className="border-t pt-5">
                        <h3 className="mb-3 font-medium">Prompt</h3>
                        <InterviewContent value={round.prompt} />
                      </div>
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
                <section className="rounded-xl border bg-card p-6">
                  <h2 className="font-semibold">
                    {round.delivery === "in_person"
                      ? "Your station"
                      : "Camera and microphone"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {round.tutor
                      ? `Tutor: ${round.tutor.name}`
                      : round.delivery === "in_person"
                        ? "Your tutor selects you when you arrive."
                        : "Your tutor will join you when the station starts."}
                  </p>
                  <div className="mt-5">
                    <InterviewMedia
                      roundId={round.id}
                      phase={round.phase}
                      delivery={round.delivery}
                      enabled={
                        !round.pausedAt &&
                        round.phase !== "completed" &&
                        !(round.endedEarly && round.mode === "exam")
                      }
                    />
                  </div>
                </section>
              </div>
            </div>
          )
        )}
      </main>
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
    </div>
  );
}
