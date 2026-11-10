"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  interviewQuestionSegments,
  type InterviewRecording,
  type InterviewStationAttempt,
} from "@altitutor/shared";
import { Maximize, Pause, Play } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { SearchableSelect } from "./searchable-select";

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
const durationProbeTimeoutMs = 8_000;

const questionColors = [
  "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-lime-500", "bg-fuchsia-500",
];

function recordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function formatInterviewRecordingAvailability(recording: InterviewRecording) {
  return recording.state === "expired" || Date.parse(recording.expiresAt) <= Date.now()
    ? "Expired"
    : `Available until ${new Date(recording.expiresAt).toLocaleDateString()}`;
}

/** Lazy, role-authorized playback for the recording mounted by the caller. */
export function InterviewRecordingPlayer({
  recording,
  loadUrl,
  src,
  intervals = [],
  questions = [],
  variant = "default",
}: {
  recording: InterviewRecording;
  intervals?: NonNullable<InterviewStationAttempt["questionIntervals"]>;
  questions?: { id: string }[];
} & (
  | { variant?: "default"; loadUrl: () => Promise<{ url: string }>; src?: never }
  | { variant: "student"; src: string; loadUrl?: never }
)) {
  const studentPlayback = variant === "student";
  const customControls = !studentPlayback || recording.kind === "audio";
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playbackReady, setPlaybackReady] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);
  const player = useRef<HTMLMediaElement | null>(null);
  const durationProbe = useRef<{
    restorePosition: number;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const clearDurationProbe = useCallback(() => {
    const probe = durationProbe.current;
    clearTimeout(probe?.timer);
    durationProbe.current = null;
    return probe;
  }, []);
  useEffect(() => () => { clearDurationProbe(); }, [clearDurationProbe]);
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
        color: index >= 0 ? questionColors[index % questionColors.length] : "bg-primary/45",
      };
    },
  );
  const activeSegment = segments.find(({ start, end }) => start <= position && position < end);
  const progressLabel = activeSegment?.questionNumber ? `Question ${activeSegment.questionNumber}` : "Between questions";
  const load = async () => {
    clearDurationProbe();
    setPlaybackReady(false);
    setDuration(0);
    setPosition(0);
    setError("");
    if (!loadUrl) {
      player.current?.load();
      return;
    }
    setLoading(true);
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
    const probe = clearDurationProbe();
    if (probe && Number.isFinite(probe.restorePosition)) {
      media.currentTime = Math.min(probe.restorePosition, media.duration);
      setPosition(media.currentTime);
    }
    setPlaybackReady(true);
  };
  const preserveUserPosition = () => {
    if (durationProbe.current)
      durationProbe.current.restorePosition = Number.NaN;
  };
  const mediaProps = {
    "aria-label": "Interview recording",
    src: src ?? url ?? undefined,
    controls: !customControls,
    playsInline: studentPlayback ? undefined : true,
    preload: studentPlayback ? "none" as const : "metadata" as const,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = event.currentTarget;
      if (customControls) {
        media.volume = volume;
        media.defaultPlaybackRate = playbackRate;
        media.playbackRate = playbackRate;
      }
      if (media.duration === Infinity) {
        // MediaRecorder WebM often omits a duration index. Seeking past EOF
        // makes the native decoder discover it without decoding through JS.
        clearDurationProbe();
        const restorePosition = media.currentTime;
        durationProbe.current = {
          restorePosition,
          timer: studentPlayback ? undefined : setTimeout(() => {
            clearDurationProbe();
            // Some browsers can play the file sequentially even if this seek stalls.
            media.currentTime = restorePosition;
            setPosition(restorePosition);
            setPlaybackReady(true);
          }, durationProbeTimeoutMs),
        };
        media.currentTime = Number.MAX_SAFE_INTEGER;
      } else {
        receiveDuration(media);
        setPlaybackReady(true);
      }
    },
    onDurationChange: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      receiveDuration(event.currentTarget),
    onSeeked: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      receiveDuration(event.currentTarget),
    onPointerDown: customControls ? undefined : preserveUserPosition,
    onKeyDown: customControls ? undefined : preserveUserPosition,
    onPlay: () => {
      preserveUserPosition();
      if (customControls) setPlaying(true);
    },
    onPause: () => { if (customControls) setPlaying(false); },
    onEnded: () => { if (customControls) setPlaying(false); },
    onVolumeChange: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      if (customControls) setVolume(event.currentTarget.volume);
    },
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const time = event.currentTarget.currentTime;
      if (!durationProbe.current && Number.isFinite(time)) setPosition(time);
    },
    onError: () => {
      clearDurationProbe();
      setPlaying(false);
      setUrl(null);
      setError("Playback failed. Reload the recording to try again.");
    },
  };
  return (
    <div ref={frame} className="group space-y-3 fullscreen:overflow-auto fullscreen:bg-background fullscreen:p-4">
      {!studentPlayback && (
        <p className="text-sm text-muted-foreground">{label} · {formatInterviewRecordingAvailability(recording)}</p>
      )}
      {!expired && recording.state === "ready" ? (
        src || url ? (
          <>
            {recording.kind === "audio" ? (
              <audio
                {...mediaProps}
                ref={(node) => {
                  player.current = node;
                }}
                className="hidden"
              />
            ) : (
              <video
                {...mediaProps}
                ref={(node) => {
                  player.current = node;
                }}
                className={studentPlayback ? "aspect-video w-full rounded-xl bg-black" : "max-h-80 w-full rounded-xl bg-black group-[:fullscreen]:max-h-[75vh]"}
              />
            )}
            {customControls && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" size="icon" variant="outline" disabled={Boolean(error) || (!studentPlayback && !playbackReady)}
                  aria-label={`${playing ? "Pause" : "Play"} ${recording.kind}`}
                  onClick={() => {
                    const media = player.current;
                    if (!media) return;
                    if (media.paused) void media.play().catch(() => undefined);
                    else media.pause();
                  }}>
                  {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Volume
                    <input type="range" min={0} max={1} step={0.05} value={volume} className="w-20 accent-current"
                      onChange={(event) => {
                        if (player.current) player.current.volume = Number(event.target.value);
                      }} />
                  </label>
                  <SearchableSelect
                    ariaLabel="Playback speed"
                    items={playbackRates}
                    value={playbackRate}
                    getItemId={String}
                    getItemLabel={(rate) => `${rate}×`}
                    searchPlaceholder="Search speeds…"
                    align="end"
                    triggerVariant="outline"
                    triggerClassName="h-8 text-xs"
                    contentWidth="10rem"
                    onValueChange={(rate) => {
                      if (rate === null) return;
                      if (player.current) {
                        player.current.defaultPlaybackRate = rate;
                        player.current.playbackRate = rate;
                      }
                      setPlaybackRate(rate);
                    }}
                  />
                  {recording.kind === "video" && (
                    <Button type="button" size="icon" variant="outline" aria-label="Toggle fullscreen"
                      onClick={() => {
                        if (document.fullscreenElement === frame.current) {
                          void document.exitFullscreen?.().catch(() => undefined);
                        } else {
                          void frame.current?.requestFullscreen?.().catch(() => undefined);
                        }
                      }}>
                      <Maximize aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-destructive">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                  Retry recording
                </Button>
              </div>
            )}
            {!studentPlayback && !error && !playbackReady && (
              <p role="status" className="text-xs text-muted-foreground">
                Preparing playback…
              </p>
            )}
            {!error && (customControls || segments.length > 0) && (
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
                    max={duration || 1}
                    disabled={!duration}
                    step={0.1}
                    value={position}
                    aria-label="Recording progress"
                    aria-valuetext={segments.length ? `${recordingTime(position)} · ${progressLabel}` : recordingTime(position)}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 [&::-moz-range-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0"
                    onChange={(event) => seek(Number(event.target.value))}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-foreground"
                    style={{ left: `${duration ? (position / duration) * 100 : 0}%` }}
                  />
                </div>
                <p className="flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                  <span>{recordingTime(position)}{segments.length ? ` · ${progressLabel}` : ""}</span>
                  <span>{duration ? recordingTime(duration) : "—"}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {segments.map((segment) => (
                    <Button
                      key={segment.index}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => seek(segment.start)}
                      aria-label={`Jump to question ${segment.questionNumber || "unknown"}, segment ${segment.index + 1}`}
                    >
                      <span aria-hidden className={cn("size-2 rounded-full", segment.color)} />
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
                  : `Load ${label.toLowerCase()}`}
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
