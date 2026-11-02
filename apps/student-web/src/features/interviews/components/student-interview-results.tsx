"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";
import {
  Badge,
  Button,
  clickableCardFocusRingCn,
  clickableCardHoverCn,
} from "@altitutor/ui";
import {
  interviewText,
  type InterviewRecording,
  type StudentInterviewRound,
} from "@altitutor/shared";
import {
  studentBtnIconOutline,
  studentCardCn,
} from "@/shared/lib/student-visual";
import { cn } from "@/shared/utils";
import { useInterviewRound } from "../hooks/use-interviews";
import { getInterviewRecording } from "../api/interviews";
import { InterviewContent } from "./interview-content";
import { InterviewError } from "./interview-error";

type Crumb = { label: string; href?: string };

function InterviewBreadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center gap-2"
          >
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : ""}>
                {item.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function ResultsBackButton() {
  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className={cn("mt-1", studentBtnIconOutline)}
    >
      <Link href="/interviews" aria-label="Back to interviews">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function ReleasedRecording({
  roundId,
  recording,
}: {
  roundId: string;
  recording: InterviewRecording;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(0);
  const expired =
    recording.state === "expired" ||
    Date.parse(recording.expiresAt) <= Date.now();
  const playable = !expired && recording.state === "ready";

  useEffect(() => {
    if (!playable || !requested) return;
    let cancelled = false;
    setUrl(null);
    setError("");
    void getInterviewRecording(roundId, recording.id)
      .then((result) => {
        if (!cancelled) setUrl(result.url);
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load recording.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [playable, recording.id, roundId, requested]);

  const label =
    recording.kind === "video" ? "Video recording" : "Audio recording";

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {label}
        {" · "}
        {expired
          ? "Expired"
          : `Available until ${new Date(recording.expiresAt).toLocaleDateString()}`}
      </p>
      {expired ? null : recording.state === "ready" ? (
        url ? (
          recording.kind === "audio" ? (
            <audio
              aria-label="Interview recording"
              className="w-full"
              src={url}
              controls
              preload="none"
            />
          ) : (
            <video
              aria-label="Interview recording"
              className="max-h-80 w-full rounded-xl bg-black"
              src={url}
              controls
              preload="none"
            />
          )
        ) : requested && !error ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading recording…
          </p>
        ) : (
          <>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequested((value) => value + 1)}
            >
              {error ? "Retry recording" : `Load ${label.toLowerCase()}`}
            </Button>
          </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {recording.state === "failed"
            ? "This recording is unavailable. Your written feedback and scores are still available."
            : "This recording is still processing."}
        </p>
      )}
    </div>
  );
}

function StationRecordings({ round }: { round: StudentInterviewRound }) {
  const result = round.result;
  if (!result) return null;
  if (!round.recordingEnabled && result.recordings.length === 0) return null;
  return (
    <div className="space-y-5" aria-label="Station recordings">
      {round.resultStations.map((station, index) => {
        const attempt = result.attempts.find(
          (item) => item.stationId === station.id,
        );
        const recordings = result.recordings.filter(
          (recording) => recording.attemptId === attempt?.id,
        );
        return (
          <div key={station.id} className="space-y-2">
            <h2 className="text-sm font-medium">
              Station {index + 1} recording
            </h2>
            {recordings.length > 0 ? (
              recordings.map((recording) => (
                <ReleasedRecording
                  key={recording.id}
                  roundId={round.id}
                  recording={recording}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recording is available for this station.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StudentInterviewResults({ roundId }: { roundId: string }) {
  const query = useInterviewRound(roundId);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  if (query.isPending)
    return (
      <p role="status" className="py-10">
        Loading results…
      </p>
    );
  if (query.error)
    return (
      <InterviewError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const round = query.data;
  if (!round) return null;
  const crumbs: Crumb[] = [
    { label: "Interviews", href: "/interviews" },
    { label: round.name },
  ];
  const result = round.result;
  if (!result)
    return (
      <div className="space-y-4 py-8">
        <InterviewBreadcrumb items={crumbs} />
        <div className="flex items-start gap-3">
          <ResultsBackButton />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Results not yet released
            </h1>
            <p className="mt-2 text-muted-foreground">
              Your tutors will release your scores, written feedback and
              recordings together when marking is complete.
            </p>
          </div>
        </div>
      </div>
    );
  const station =
    round.resultStations.find((item) => item.id === selectedStationId) ??
    round.resultStations[0];
  const attempt = result.attempts.find(
    (item) => item.stationId === station?.id,
  );
  const stationNumber =
    round.resultStations.findIndex((item) => item.id === station?.id) + 1;
  return (
    <div className="space-y-7 py-8">
      <header>
        <InterviewBreadcrumb items={crumbs} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <ResultsBackButton />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                {round.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Released{" "}
                {new Date(result.releasedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · Revision {result.revision}
              </p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted px-6 py-4">
            <p className="text-sm text-muted-foreground">Total score</p>
            <p className="text-3xl font-semibold tabular-nums">
              {result.score}{" "}
              <span className="text-xl font-normal text-muted-foreground">
                / {result.possiblePoints}
              </span>
            </p>
            {result.partial && (
              <Badge variant="secondary" className="mt-2">
                Partial result
              </Badge>
            )}
          </div>
        </div>
      </header>
      {result.partial && (
        <p className="rounded-lg border bg-muted/50 p-4 text-sm">
          One or more stations were not assessed. Their possible points are
          excluded from your total. Select a station to see the reason.
        </p>
      )}
      <div
        className="flex gap-3 overflow-x-auto overscroll-x-contain px-0.5 py-1"
        role="group"
        aria-label="Station results"
      >
        {round.resultStations.map((item, index) => {
          const mark = result.attempts.find(
            (entry) => entry.stationId === item.id,
          );
          const selected = item.id === station?.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedStationId(item.id)}
              aria-pressed={selected}
              className={cn(
                studentCardCn(
                  "group relative w-44 shrink-0 p-4 text-left",
                  selected ? "bg-muted ring-2 ring-foreground/25" : undefined,
                ),
                clickableCardHoverCn,
                clickableCardFocusRingCn,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Station {index + 1}</span>
                {mark?.completed && (
                  <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {mark?.notAssessedReason ? (
                  <span className="text-base font-medium">Not assessed</span>
                ) : (
                  `${mark?.score ?? "—"} / ${item.maximumPoints}`
                )}
              </p>
            </button>
          );
        })}
      </div>
      <StationRecordings round={round} />
      {station && attempt && (
        <section className={studentCardCn("space-y-6 p-6")}>
          <h2 className="text-xl font-semibold">Station {stationNumber}</h2>
          {attempt.notAssessedReason ? (
            <div>
              <h3 className="font-medium">Not assessed</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {attempt.notAssessedReason}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This station is excluded from the total possible score.
              </p>
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              General feedback
            </h3>
            <div className="mt-2">
              {interviewText(attempt.generalFeedback ?? null).trim() ? (
                <InterviewContent value={attempt.generalFeedback ?? null} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No general feedback for this station.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-6">
            {station.questions.map((question, index) => {
              const feedback = attempt.feedback.find(
                (entry) => entry.placementId === question.id,
              );
              return (
                <article key={question.id} className="space-y-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-base font-medium">
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <InterviewContent
                        value={question.question}
                        className="[&>p:first-child]:!mt-0"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Tutor feedback
                    </h3>
                    <div className="mt-2">
                      {feedback ? (
                        <InterviewContent value={feedback.value} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No written feedback for this question.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
