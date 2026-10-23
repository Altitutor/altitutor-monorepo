"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, CheckCircle } from "lucide-react";
import { Badge, Button } from "@altitutor/ui";
import { interviewText, type InterviewRecording } from "@altitutor/shared";
import { useInterviewRound } from "../hooks/use-interviews";
import { getInterviewRecording } from "../api/interviews";
import { InterviewContent } from "./interview-content";
import { InterviewError } from "./interview-error";

function ReleasedRecording({
  roundId,
  recording,
}: {
  roundId: string;
  recording: InterviewRecording;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const expired =
    recording.state === "expired" ||
    Date.parse(recording.expiresAt) <= Date.now();
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setUrl((await getInterviewRecording(roundId, recording.id)).url);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load recording.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">
            {recording.kind === "video" ? "Video recording" : "Audio recording"}
          </h4>
          <p className="text-xs text-muted-foreground">
            {expired
              ? "Recording expired"
              : `Available until ${new Date(recording.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
        {!expired && recording.state === "ready" && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              void load();
            }}
          >
            <Play className="mr-2 h-4 w-4" />
            {loading ? "Loading…" : url ? "Reload recording" : "Play recording"}
          </Button>
        )}
      </div>
      {!expired && recording.state !== "ready" && (
        <p className="text-sm text-muted-foreground">
          {recording.state === "failed"
            ? "This recording is unavailable. Your written feedback and scores are still available."
            : "This recording is still processing."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {url &&
        !expired &&
        (recording.kind === "audio" ? (
          <audio
            aria-label="Interview recording"
            className="w-full"
            src={url}
            controls
            preload="metadata"
          />
        ) : (
          <video
            aria-label="Interview recording"
            className="w-full rounded-md bg-black"
            src={url}
            controls
            preload="metadata"
          />
        ))}
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
  const result = round.result;
  if (!result)
    return (
      <div className="space-y-4 py-10">
        <Button asChild variant="outline">
          <Link href="/interviews">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Interviews
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Results not yet released</h1>
        <p className="text-muted-foreground">
          Your tutors will release your scores, written feedback and recordings
          together when marking is complete.
        </p>
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
      <header className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/interviews">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Interviews
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
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
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Station results"
      >
        {round.resultStations.map((item, index) => {
          const mark = result.attempts.find(
            (entry) => entry.stationId === item.id,
          );
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedStationId(item.id)}
              aria-pressed={item.id === station?.id}
              className={`rounded-xl border p-5 text-left transition-colors hover:bg-muted/50 ${item.id === station?.id ? "bg-muted" : "bg-card"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Station {index + 1}</span>
                {mark?.completed && (
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
      {station && attempt && (
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold">Station {stationNumber}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your released feedback
            </p>
          </div>
          {attempt.notAssessedReason ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-medium">Not assessed</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {attempt.notAssessedReason}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This station is excluded from the total possible score.
              </p>
            </div>
          ) : null}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="mb-2 font-medium">General station feedback</h3>
            {interviewText(attempt.generalFeedback ?? null).trim() ? (
              <InterviewContent value={attempt.generalFeedback ?? null} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No general feedback for this station.
              </p>
            )}
          </div>
          {station.questions.map((question, index) => {
            const feedback = attempt.feedback.find(
              (entry) => entry.placementId === question.id,
            );
            return (
              <article key={question.id} className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Question {index + 1}
                </h3>
                <InterviewContent value={question.question} />
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="mb-2 text-sm font-medium">Tutor feedback</h4>
                  {feedback ? (
                    <InterviewContent value={feedback.value} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No written feedback for this question.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
          {result.recordings.filter(
            (recording) => recording.attemptId === attempt.id,
          ).length > 0 && (
            <div className="space-y-3 border-t pt-5">
              <h3 className="font-semibold">Recordings</h3>
              {result.recordings
                .filter((recording) => recording.attemptId === attempt.id)
                .map((recording) => (
                  <ReleasedRecording
                    key={recording.id}
                    roundId={round.id}
                    recording={recording}
                  />
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
