"use client";

import React, { useRef, useState } from "react";
import {
  interviewQuestionSegments,
  type InterviewRecording,
  type InterviewStationAttempt,
} from "@altitutor/shared";
import { cn } from "../lib/cn";
import { Button } from "./button";

const questionColors = [
  "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-lime-500", "bg-fuchsia-500",
];

function recordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

/** Lazy, role-authorized playback. Signed URLs are requested only on user action. */
export function InterviewRecordingPlayer({
  recording,
  loadUrl,
  intervals = [],
  questions = [],
  variant = "default",
}: {
  recording: InterviewRecording;
  loadUrl: () => Promise<{ url: string }>;
  intervals?: NonNullable<InterviewStationAttempt["questionIntervals"]>;
  questions?: { id: string }[];
  variant?: "default" | "student";
}) {
  const studentPlayback = variant === "student";
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const player = useRef<HTMLMediaElement | null>(null);
  const durationProbe = useRef<{ restorePosition: number } | null>(null);
  const expired =
    recording.state === "expired" ||
    Date.parse(recording.expiresAt) <= Date.now();
  const label =
    recording.kind === "video" ? "Video recording" : "Audio recording";
  const segments = interviewQuestionSegments(intervals, recording.startedAt ?? recording.createdAt, duration).map(
    (segment) => {
      const index = questions.findIndex((question) => question.id === segment.questionId);
      return {
        ...segment,
        questionNumber: index + 1,
        color: studentPlayback && index >= 0 ? questionColors[index % questionColors.length] : "bg-primary/45",
      };
    },
  );
  const activeSegment = segments.find(({ start, end }) => start <= position && position < end);
  const progressLabel = activeSegment?.questionNumber ? `Question ${activeSegment.questionNumber}` : "Between questions";
  const load = async () => {
    setLoading(true);
    durationProbe.current = null;
    setDuration(0);
    setPosition(0);
    setError("");
    try {
      setUrl((await loadUrl()).url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load recording.",
      );
    } finally {
      setLoading(false);
    }
  };
  const seek = (seconds: number) => {
    if (player.current) {
      player.current.currentTime = seconds;
      setPosition(seconds);
    }
  };
  const receiveDuration = (media: HTMLMediaElement) => {
    if (!Number.isFinite(media.duration) || media.duration <= 0) return;
    setDuration(media.duration);
    const probe = durationProbe.current;
    durationProbe.current = null;
    if (probe && Number.isFinite(probe.restorePosition)) {
      media.currentTime = Math.min(probe.restorePosition, media.duration);
      setPosition(media.currentTime);
    }
  };
  const preserveUserPosition = () => {
    if (durationProbe.current)
      durationProbe.current.restorePosition = Number.NaN;
  };
  const mediaProps = {
    "aria-label": "Interview recording",
    src: url ?? undefined,
    controls: true,
    autoPlay: studentPlayback,
    preload: "metadata" as const,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = event.currentTarget;
      if (media.duration === Infinity) {
        // MediaRecorder WebM often omits a duration index. Seeking past EOF
        // makes the native decoder discover it without decoding through JS.
        durationProbe.current = { restorePosition: media.currentTime };
        media.currentTime = Number.MAX_SAFE_INTEGER;
      } else receiveDuration(media);
    },
    onDurationChange: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      receiveDuration(event.currentTarget),
    onSeeked: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      receiveDuration(event.currentTarget),
    onPointerDown: preserveUserPosition,
    onKeyDown: preserveUserPosition,
    onPlay: studentPlayback ? undefined : preserveUserPosition,
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      setPosition(event.currentTarget.currentTime),
    onError: () => {
      setUrl(null);
      setError("Playback failed. Reload the recording to try again.");
    },
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {!studentPlayback && label + " · "}
        {expired
          ? "Expired"
          : `Available until ${new Date(recording.expiresAt).toLocaleDateString()}`}
      </p>
      {!expired && recording.state === "ready" ? (
        url ? (
          <>
            {recording.kind === "audio" ? (
              <audio
                {...mediaProps}
                ref={(node) => {
                  player.current = node;
                }}
                className="w-full"
              />
            ) : (
              <video
                {...mediaProps}
                ref={(node) => {
                  player.current = node;
                }}
                className={studentPlayback ? "w-full rounded-xl bg-black" : "max-h-80 w-full rounded-xl bg-black"}
              />
            )}
            {segments.length > 0 && (
              <div
                className="space-y-2"
                aria-label="Question recording segments"
              >
                <div className="relative h-3 overflow-hidden rounded-full bg-muted focus-within:ring-2 focus-within:ring-ring">
                  {segments.map((segment) => (
                    <span
                      key={segment.index}
                      className={cn("absolute inset-y-0 border-r-2 border-background", segment.color)}
                      style={{
                        left: `${(segment.start / duration) * 100}%`,
                        width: `${((segment.end - segment.start) / duration) * 100}%`,
                      }}
                    />
                  ))}
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={position}
                    aria-label="Recording progress"
                    aria-valuetext={studentPlayback ? recordingTime(position) + " · " + progressLabel : undefined}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => seek(Number(event.target.value))}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-foreground"
                    style={{ left: `${(position / duration) * 100}%` }}
                  />
                </div>
                {studentPlayback && (
                  <p className="flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                    <span>{recordingTime(position)} · {progressLabel}</span>
                    <span>{recordingTime(duration)}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {segments.map((segment) => (
                    <Button
                      key={segment.index}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => seek(segment.start)}
                      aria-label={`${studentPlayback ? "Jump to" : "Play"} question ${segment.questionNumber || "unknown"}, segment ${segment.index + 1}`}
                    >
                      {studentPlayback && <span aria-hidden className={cn("size-2 rounded-full", segment.color)} />}
                      Question {segment.questionNumber || "—"} · {recordingTime(segment.start)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading
                ? "Loading recording…"
                : error
                  ? "Retry recording"
                  : studentPlayback ? "Play recording" : `Load ${label.toLowerCase()}`}
            </Button>
          </>
        )
      ) : !expired ? (
        <p className="text-sm text-muted-foreground">
          {recording.state === "failed"
            ? "This recording is unavailable. Your written feedback and scores are still available."
            : "This recording is still processing."}
        </p>
      ) : null}
    </div>
  );
}
