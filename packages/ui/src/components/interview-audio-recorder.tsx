"use client";

import React, { useEffect, useRef, useState } from "react";
import type { InterviewMediaTicket, InterviewPhase } from "@altitutor/shared";
import { Mic, MicOff } from "lucide-react";
import { Button } from "./button";
import {
  flushInterviewAudio,
  saveInterviewAudio,
} from "../lib/interview-audio-outbox";

export function InterviewAudioRecorder({
  roundId,
  phase,
  enabled,
}: {
  roundId: string;
  phase: InterviewPhase;
  enabled: boolean;
}) {
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [status, setStatus] = useState(
    "Enable your microphone to record in-person answers.",
  );
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [retry, setRetry] = useState(0);
  const activeRecorder = useRef<MediaRecorder | null>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let attemptId: string | null = null;
    let captureId: string | null = null;
    let actorId: string | null = null;
    let clockOffset = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let segmentTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const flush = async () => {
      if (!actorId) return;
      const result = await flushInterviewAudio(roundId, actorId);
      if (!disposed) {
        setPendingCount(result.pending);
        if (result.error) setError(result.error);
      }
    };
    const stop = () => {
      if (segmentTimer) clearTimeout(segmentTimer);
      if (expiryTimer) clearTimeout(expiryTimer);
      const previous = recorder;
      recorder = null;
      attemptId = null;
      captureId = null;
      if (activeRecorder.current === previous) activeRecorder.current = null;
      if (previous && previous.state !== "inactive") previous.stop();
      if (!disposed) setRecording(false);
    };
    const startSegment = (selectedAttempt: string, selectedCapture: string) => {
      if (!stream || disposed || !enabled || !microphoneEnabled || !actorId)
        return;
      const recordingActorId = actorId;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType)
        throw new Error(
          "This browser cannot record audio. Use a supported browser or continue without recording.",
        );
      const instance = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      const chunks: Blob[] = [];
      const id = crypto.randomUUID();
      let continued = false;
      recorder = instance;
      activeRecorder.current = instance;
      attemptId = selectedAttempt;
      captureId = selectedCapture;
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      instance.onerror = () => {
        if (!disposed) {
          setRecording(false);
          setError(
            "Audio recording failed. You can continue the interview and retry the microphone.",
          );
        }
      };
      instance.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > 0) {
          void saveInterviewAudio({
            id,
            actorId: recordingActorId,
            roundId,
            attemptId: selectedAttempt,
            captureId: selectedCapture,
            createdAt: Date.now(),
            blob,
          })
            .catch(() => {
              if (!disposed)
                setError(
                  "Audio could not be saved on this device. Keep this page open while it uploads.",
                );
            })
            .then(flush);
        }
        if (
          continued &&
          !disposed &&
          attemptId === selectedAttempt &&
          captureId === selectedCapture
        ) {
          try {
            startSegment(selectedAttempt, selectedCapture);
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Recording failed.",
            );
          }
        }
      };
      instance.start();
      setRecording(true);
      setStatus("Recording audio at this station.");
      segmentTimer = setTimeout(() => {
        if (recorder === instance && instance.state !== "inactive") {
          continued = true;
          instance.stop();
        }
      }, 30_000);
    };
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/media${enabled && microphoneEnabled ? '?capture=1' : ''}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(
            "Unable to verify recording access. Recording is stopped until connection returns.",
          );
        const policy = (await response.json()) as InterviewMediaTicket;
        if (disposed) return;
        actorId = policy.actorId ?? null;
        await flush();
        if (disposed) return;
        clockOffset = policy.serverNow
          ? Date.parse(policy.serverNow) - Date.now()
          : 0;
        if (
          !enabled ||
          !actorId ||
          !policy.recordingEnabled ||
          !policy.attemptId ||
          !policy.captureId ||
          !microphoneEnabled
        ) {
          stop();
          setStatus(
            !microphoneEnabled && policy.recordingEnabled
              ? "Microphone is off. This answer is not being recorded."
              : "Audio recording is off for this phase.",
          );
          return;
        }
        if (
          attemptId &&
          (attemptId !== policy.attemptId || captureId !== policy.captureId)
        )
          stop();
        if (!stream) {
          if (
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined"
          )
            throw new Error(
              "Audio recording is not supported in this browser.",
            );
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          if (disposed) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          activeStream.current = stream;
        }
        if (!recorder) startSegment(policy.attemptId, policy.captureId);
        if (expiryTimer) clearTimeout(expiryTimer);
        if (policy.expiresAt)
          expiryTimer = setTimeout(
            stop,
            Math.max(
              0,
              Date.parse(policy.expiresAt) - Date.now() - clockOffset,
            ),
          );
        if (policy.warning) setError(policy.warning);
      } catch (failure) {
        stop();
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : "Audio recording unavailable.",
          );
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, 3_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (activeStream.current === stream) activeStream.current = null;
    };
  }, [roundId, phase, enabled, microphoneEnabled, retry]);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("altitutor:interview-audio-pending", {
        detail: { roundId, pending: pendingCount, recording },
      }),
    );
    const warn = (event: BeforeUnloadEvent) => {
      if (recording || pendingCount > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [roundId, pendingCount, recording]);
  const toggle = () => {
    if (microphoneEnabled) {
      if (activeRecorder.current?.state === "recording")
        activeRecorder.current.stop();
      activeStream.current?.getTracks().forEach((track) => track.stop());
    }
    setError("");
    setMicrophoneEnabled(!microphoneEnabled);
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">In-person audio</h3>
      <p role="status" className="text-sm text-muted-foreground">
        {recording && enabled ? "Recording audio at this station." : status}
      </p>
      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingCount} audio segment{pendingCount === 1 ? "" : "s"} waiting to
          upload
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Retry recording / uploads
          </Button>
        )}
      </div>
    </div>
  );
}
