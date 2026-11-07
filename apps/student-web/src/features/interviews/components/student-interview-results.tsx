"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";
import {
  Badge,
  InterviewRecordingPlayer,
  InterviewReviewDisclosure,
  Button,
  clickableCardFocusRingCn,
  clickableCardHoverCn,
} from "@altitutor/ui";
import {
  interviewQuestionSegments,
  interviewText,
  type InterviewRecording,
  type InterviewStationAttempt,
  type StudentInterviewRound,
} from "@altitutor/shared";
import {
  studentBtnIconOutline,
  studentCardCn,
} from "@/shared/lib/student-visual";
import { cn } from "@/shared/utils";
import { useInterviewRound } from "../hooks/use-interviews";
import { readingClock } from "../lib/presentation";
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

function StationRecording({
  roundId,
  recordings,
  recording,
  onRecordingChange,
  attempt,
  station,
}: {
  roundId: string;
  recordings: InterviewRecording[];
  recording?: InterviewRecording;
  onRecordingChange: (id: string) => void;
  attempt?: InterviewStationAttempt;
  station: StudentInterviewRound["resultStations"][number];
}) {
  return (
    <section className={studentCardCn("space-y-3 p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Recording</h2>
        {recordings.length > 1 && (
          <select
            aria-label="Recording clip"
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={recording?.id ?? ""}
            onChange={(event) => onRecordingChange(event.target.value)}
          >
            {recordings.map((item, index) => (
              <option key={item.id} value={item.id}>Clip {index + 1}</option>
            ))}
          </select>
        )}
      </div>
      {recording ? (
        <InterviewRecordingPlayer
          key={recording.id}
          recording={recording}
          loadUrl={() => getInterviewRecording(roundId, recording.id)}
          intervals={attempt?.questionIntervals}
          questions={station.questions ?? []}
          variant="student"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No recording is available for this station.
        </p>
      )}
    </section>
  );
}

function questionTimingSummary(segments: { start: number; end: number }[]) {
  if (!segments.length) return null;
  const ranges = segments.map(({ start, end }) =>
    readingClock(Math.floor(start)) + " - " + readingClock(Math.floor(end)),
  );
  const total = Math.round(segments.reduce((seconds, { start, end }) => seconds + end - start, 0));
  return ranges.join(", ") + " · " + total + (total === 1 ? " second" : " seconds");
}

function StationFeedback({
  station,
  stationNumber,
  attempt,
  recording,
}: {
  station: StudentInterviewRound["resultStations"][number];
  stationNumber: number;
  attempt: InterviewStationAttempt;
  recording?: InterviewRecording;
}) {
  const intervals = attempt.questionIntervals ?? [];
  const origin = recording?.startedAt ?? recording?.createdAt ?? intervals[0]?.startedAt;
  const timings = origin ? interviewQuestionSegments(intervals, origin) : [];
  const score = attempt.notAssessedReason ? "Not assessed" : `${attempt.score ?? "—"} / ${station.maximumPoints}`;
  return (
    <section className={studentCardCn("space-y-3 p-5")} aria-label="Station feedback">
      <h2 className="font-semibold">Feedback</h2>
      <InterviewReviewDisclosure defaultOpen title={<strong>Station {stationNumber}</strong>}
        detail={<strong>{score}</strong>}>
        {attempt.notAssessedReason && (
          <div className="space-y-1 px-2 py-2 text-sm">
            <p className="font-medium">Not assessed</p>
            <p className="whitespace-pre-wrap">{attempt.notAssessedReason}</p>
            <p className="text-xs text-muted-foreground">This station is excluded from the total possible score.</p>
          </div>
        )}
        <div className="space-y-1 px-2 py-2 text-sm">
          <p className="font-medium">General feedback</p>
          {interviewText(attempt.generalFeedback ?? null).trim() ? (
            <InterviewContent value={attempt.generalFeedback ?? null} />
          ) : (
            <p className="text-muted-foreground">No general feedback for this station.</p>
          )}
        </div>
        {(station.questions ?? []).map((question, index) => {
          const feedback = attempt.feedback.find((entry) => entry.placementId === question.id);
          const timing = questionTimingSummary(timings.filter((segment) => segment.questionId === question.id));
          return (
            <InterviewReviewDisclosure key={question.id} defaultOpen
              title={<span><strong>Question {index + 1}</strong> · {interviewText(question.question)}</span>}
              detail={timing && <span className="hidden max-w-64 text-xs leading-5 text-muted-foreground lg:block">{timing}</span>}>
              <div className="space-y-2 px-2 py-2 text-sm">
                {timing && <p className="text-xs tabular-nums text-muted-foreground lg:hidden">{timing}</p>}
                {feedback ? <InterviewContent value={feedback.value} /> : (
                  <p className="text-muted-foreground">No written feedback for this question.</p>
                )}
              </div>
            </InterviewReviewDisclosure>
          );
        })}
      </InterviewReviewDisclosure>
    </section>
  );
}

function StationResult({ round, station, attempt, recordings, stationNumber }: {
  round: StudentInterviewRound;
  station: StudentInterviewRound["resultStations"][number];
  attempt?: InterviewStationAttempt;
  recordings: InterviewRecording[];
  stationNumber: number;
}) {
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>();
  const recording = recordings.find((item) => item.id === selectedRecordingId) ?? recordings[0];
  return (
    <>
      {(round.recordingEnabled || recordings.length > 0) && (
        <StationRecording
          roundId={round.id}
          recordings={recordings}
          recording={recording}
          onRecordingChange={setSelectedRecordingId}
          station={station}
          attempt={attempt}
        />
      )}
      {attempt && (
        <StationFeedback station={station} stationNumber={stationNumber} attempt={attempt} recording={recording} />
      )}
    </>
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
  const recordings = result.recordings.filter((recording) => recording.attemptId === attempt?.id);
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
      {station && (
        <StationResult key={station.id} round={round} station={station} attempt={attempt}
          recordings={recordings} stationNumber={stationNumber} />
      )}
    </div>
  );
}
