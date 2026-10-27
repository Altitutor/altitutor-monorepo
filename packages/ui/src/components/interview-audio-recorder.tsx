"use client";

import React, { useEffect, useRef, useState } from "react";
import type { InterviewMediaTicket, InterviewPhase } from "@altitutor/shared";
import { Mic, MicOff } from "lucide-react";
import { Button } from "./button";
import {
  flushInterviewAudio,
  saveInterviewAudio,
} from "../lib/interview-audio-outbox";
import { randomUuid } from "../lib/random-uuid";

export function InterviewAudioRecorder({
  roundId,
  phase,
  enabled,
  plain = false,
  registerFinalize,
}: {
  roundId: string;
  phase: InterviewPhase;
  enabled: boolean;
  plain?: boolean;
  registerFinalize?: (finalize: (() => Promise<void>) | null) => void;
}) {
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [retry, setRetry] = useState(0);
  const [serverRecording, setServerRecording] = useState(false);
  const activeRecorder = useRef<MediaRecorder | null>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const muted = useRef(true);
  const captureArmed = useRef(false);
  const finishing = useRef(false);
  const pendingSegments = useRef(new Set<Promise<void>>());
  const lastActorId = useRef<string | null>(null);
  const finalize = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    registerFinalize?.(() => finalize.current());
    return () => registerFinalize?.(null);
  }, [registerFinalize]);
  const [recording, setRecording] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 32 }, () => 8),
  );
  useEffect(() => {
    if (!armed || !enabled) {
      setMicStream(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    let cancelled = false;
    let local: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        (next.getAudioTracks?.() ?? next.getTracks()).forEach((track) => {
          track.enabled = !muted.current;
        });
        local = next;
        activeStream.current = next;
        setMicStream(next);
        setError("");
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "Microphone permission was denied.",
          );
      });
    return () => {
      cancelled = true;
      local?.getTracks().forEach((track) => track.stop());
      if (activeStream.current === local) activeStream.current = null;
      setMicStream(null);
    };
  }, [armed, enabled]);
  useEffect(() => {
    if (!micStream || !recording) return;
    const AudioCtor =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor || typeof requestAnimationFrame !== "function") return;
    let context: AudioContext;
    try {
      context = new AudioCtor();
      const source = context.createMediaStreamSource(micStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0;
      let last = 0;
      const tick = (time: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const sample = (value - 128) / 128;
          sum += sample * sample;
        }
        if (time - last > 80) {
          last = time;
          const next = Math.min(
            100,
            Math.max(8, Math.round(Math.sqrt(sum / data.length) * 280)),
          );
          setBars((current) => [...current.slice(1), next]);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(frame);
        void context.close();
      };
    } catch {
      return;
    }
  }, [micStream, recording]);
  useEffect(() => {
    let disposed = false;
    const stream: MediaStream | null = micStream;
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
    finalize.current = async () => {
      finishing.current = true;
      stop();
      // Capture is stopped even if uploads fail and navigation stays blocked.
      // Keep the control truthful and permit one-click microphone re-enable.
      muted.current = true;
      setMicrophoneEnabled(false);
      setArmed(false);
      // onstop emits its final data asynchronously. Every active segment has
      // a promise before recording starts, including segments from old phases.
      await Promise.all([...pendingSegments.current]);
      if (!lastActorId.current) return;
      const result = await flushInterviewAudio(roundId, lastActorId.current);
      if (!disposed) setPendingCount(result.pending);
      if (result.pending > 0 || result.error)
        throw new Error(
          result.error ??
            "Audio is still waiting to upload. Keep this page open and retry.",
        );
    };
    const startSegment = (selectedAttempt: string, selectedCapture: string) => {
      if (!stream || disposed || !enabled || !actorId || finishing.current)
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
      const id = randomUuid();
      let segmentSaved!: () => void;
      const saved = new Promise<void>((resolve) => {
        segmentSaved = resolve;
      });
      pendingSegments.current.add(saved);
      void saved.then(() => pendingSegments.current.delete(saved));
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
            .then(flush)
            .catch(() => {
              if (!disposed)
                setError(
                  "Audio is still waiting to upload. Keep this page open and retry.",
                );
            })
            .finally(segmentSaved);
        } else segmentSaved();
        if (
          continued &&
          !disposed &&
          !finishing.current &&
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
      try {
        instance.start();
      } catch (failure) {
        segmentSaved();
        throw failure;
      }
      setRecording(true);
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
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/media${enabled && captureArmed.current ? "?capture=1" : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(
            "Unable to verify recording access. Recording is stopped until connection returns.",
          );
        const policy = (await response.json()) as InterviewMediaTicket;
        if (disposed) return;
        actorId = policy.actorId ?? null;
        if (actorId) lastActorId.current = actorId;
        await flush();
        if (disposed) return;
        clockOffset = policy.serverNow
          ? Date.parse(policy.serverNow) - Date.now()
          : 0;
        const allowed = Boolean(
          enabled &&
            !finishing.current &&
            actorId &&
            policy.recordingEnabled &&
            policy.attemptId &&
            policy.captureId,
        );
        setServerRecording(Boolean(enabled && policy.recordingEnabled));
        if (!allowed || !stream || !policy.attemptId || !policy.captureId) {
          stop();
          return;
        }
        if (typeof MediaRecorder === "undefined")
          throw new Error("Audio recording is not supported in this browser.");
        if (
          attemptId &&
          (attemptId !== policy.attemptId || captureId !== policy.captureId)
        )
          stop();
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
          timer = setTimeout(
            () => {
              void poll();
            },
            enabled && microphoneEnabled ? 10_000 : 30_000,
          );
      }
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [roundId, phase, enabled, retry, micStream]);
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
    setError("");
    if (microphoneEnabled) {
      muted.current = true;
      (
        activeStream.current?.getAudioTracks?.() ??
        activeStream.current?.getTracks() ??
        []
      ).forEach((track) => {
        track.enabled = false;
      });
      setMicrophoneEnabled(false);
      return;
    }
    muted.current = false;
    finishing.current = false;
    captureArmed.current = true;
    (
      activeStream.current?.getAudioTracks?.() ??
      activeStream.current?.getTracks() ??
      []
    ).forEach((track) => {
      track.enabled = true;
    });
    setArmed(true);
    setMicrophoneEnabled(true);
  };
  const caption = recording
    ? null
    : phase === "waiting" || phase === "reading"
      ? "Recording will start during question time"
      : serverRecording
        ? null
        : enabled
          ? "Recording has finished"
          : null;
  return (
    <div className={plain ? "space-y-3" : "space-y-3 rounded-lg border p-4"}>
      <h3 className="text-sm font-medium">In-person audio</h3>
      {caption && (
        <p role="status" className="text-sm text-muted-foreground">
          {caption}
        </p>
      )}
      {recording && (
        <div
          aria-label="Recording waveform"
          className="flex h-12 items-center gap-[3px]"
        >
          {bars.map((bar, index) => (
            <span
              key={index}
              className="w-[3px] rounded-full bg-neutral-900 dark:bg-neutral-100"
              style={{ height: `${bar}%` }}
            />
          ))}
        </div>
      )}
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
              finishing.current = false;
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
