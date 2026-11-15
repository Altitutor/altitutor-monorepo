"use client";

import React from "react";
import type { InterviewPhase } from "@altitutor/shared";
import { Mic, MicOff } from "lucide-react";
import { Button } from "./button";
import { MicrophoneLevel } from "./microphone-level";
import { useInterviewCapture } from "../hooks/use-interview-capture";

export function InterviewAudioRecorder(props: {
  roundId: string;
  phase: InterviewPhase;
  enabled: boolean;
  plain?: boolean;
  registerFinalize?: (finalize: (() => Promise<void>) | null) => void;
  microphonePreference?: React.MutableRefObject<boolean>;
}) {
  const { phase, enabled, plain = false } = props;
  const {
    microphoneEnabled,
    micStream,
    recording,
    serverRecording,
    pendingCount,
    downloadRecording,
    error,
    toggle,
    retryCapture,
  } = useInterviewCapture(props);
  const caption =
    !enabled && recording
      ? "Interview paused — the recording continues with silence"
      : recording
        ? serverRecording
          ? "Recording this station"
          : "Recording silence"
        : phase === "waiting" || phase === "reading"
          ? "Microphone ready. Recording starts during question time."
          : "Recording has finished";
  return (
    <div className={plain ? "space-y-3" : "space-y-3 rounded-lg border p-4"}>
      <h3 className="text-sm font-medium">In-person audio</h3>
      <p role="status" className="text-sm text-muted-foreground">
        {caption}
      </p>
      <MicrophoneLevel stream={micStream} paused={!microphoneEnabled || !enabled} />
      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingCount} recording{pendingCount === 1 ? "" : "s"} waiting to
          upload
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {downloadRecording && (
          <Button size="sm" variant="outline" onClick={downloadRecording}>
            Download recording backup
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={toggle}
          aria-pressed={microphoneEnabled}
        >
          {microphoneEnabled ? (
            <MicOff className="mr-2 h-4 w-4" />
          ) : (
            <Mic className="mr-2 h-4 w-4" />
          )}
          {microphoneEnabled ? "Disable microphone" : "Enable microphone"}
        </Button>
        {error && (
          <Button size="sm" variant="outline" onClick={retryCapture}>
            Retry recording / uploads
          </Button>
        )}
      </div>
    </div>
  );
}
