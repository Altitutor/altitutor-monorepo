"use client";

import React, { useEffect, useState } from "react";
import type { InterviewPhase } from "@altitutor/shared";
import { Mic, MicOff } from "lucide-react";
import { Button } from "./button";
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
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!micStream || !microphoneEnabled || !enabled) {
      setLevel(0);
      return;
    }
    const AudioCtor =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor || typeof requestAnimationFrame !== "function") return;
    let context: AudioContext | undefined;
    let frame = 0;
    let disposed = false;
    try {
      context = new AudioCtor();
      const source = context.createMediaStreamSource(micStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (time: number) => {
        if (disposed) return;
        analyser.getByteTimeDomainData(data);
        if (time - last > 80) {
          last = time;
          let sum = 0;
          for (const value of data) sum += ((value - 128) / 128) ** 2;
          setLevel(
            Math.min(100, Math.round(Math.sqrt(sum / data.length) * 280)),
          );
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      /* A decorative meter must never prevent recording. */
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      void context?.close().catch(() => undefined);
    };
  }, [micStream, microphoneEnabled, enabled]);
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
      <div
        aria-label={recording ? "Recording waveform" : "Microphone preview"}
        className="flex h-10 items-center gap-1"
      >
        {Array.from({ length: 24 }, (_, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-neutral-900 dark:bg-neutral-100"
            style={{
              height: `${Math.max(8, level * (1 - Math.abs(index - 11.5) / 16))}%`,
            }}
          />
        ))}
      </div>
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
