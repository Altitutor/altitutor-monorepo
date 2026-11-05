"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewMediaTicket, InterviewPhase } from "@altitutor/shared";
import {
  appendInterviewAudio,
  flushInterviewAudio,
  recoverInterviewAudio,
  saveInterviewAudio,
} from "../lib/interview-audio-outbox";

const maximumBytes = 50 * 1024 * 1024;
const stopBytes = 48 * 1024 * 1024;
let waitingMicrophone: {
  roundId: string;
  stream: MediaStream;
  microphoneEnabled: boolean;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

/** One encoder per station take. Phase/pause changes gate its track, not its clock. */
export function useInterviewAudioCapture({
  roundId,
  phase,
  enabled,
  registerFinalize,
}: {
  roundId: string;
  phase: InterviewPhase;
  enabled: boolean;
  registerFinalize?: (finalize: (() => Promise<void>) | null) => void;
}) {
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [serverRecording, setServerRecording] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [downloadRecording, setDownloadRecording] = useState<
    (() => void) | null
  >(null);
  const latest = useRef({ phase, enabled, microphoneEnabled });
  latest.current = { phase, enabled, microphoneEnabled };
  const finalize = useRef<() => Promise<void>>(async () => undefined);
  const refresh = useRef<() => void>(() => undefined);
  const finishing = useRef(false);
  const audible = useRef(true);
  useEffect(() => {
    registerFinalize?.(() => finalize.current());
    return () => registerFinalize?.(null);
  }, [registerFinalize]);
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    const warm =
      waitingMicrophone?.roundId === roundId ? waitingMicrophone : null;
    if (warm) {
      clearTimeout(warm.timer);
      waitingMicrophone = null;
      setMicrophoneEnabled(warm.microphoneEnabled);
    }
    void (
      warm
        ? Promise.resolve(warm.stream)
        : navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    )
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        next.getTracks().forEach((track) => {
          track.enabled =
            latest.current.enabled &&
            (warm?.microphoneEnabled ?? latest.current.microphoneEnabled);
        });
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
      if (stream && latest.current.phase === "waiting") {
        const held = stream;
        const timer = setTimeout(() => {
          held.getTracks().forEach((track) => track.stop());
          if (waitingMicrophone?.stream === held) waitingMicrophone = null;
        }, 5_000);
        waitingMicrophone = {
          roundId,
          stream: held,
          microphoneEnabled: latest.current.microphoneEnabled,
          timer,
        };
      } else stream?.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    };
  }, [roundId, retry]);
  useEffect(() => {
    audible.current = false;
    micStream?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    refresh.current();
  }, [phase, enabled, micStream]);
  useEffect(() => {
    if (!micStream) return;
    let disposed = false;
    let actorId: string | null = null;
    let captureId: string | null = null;
    let recorder: MediaRecorder | null = null;
    let saved = Promise.resolve();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let authorizationTimer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let refreshAgain = false;
    let recovered = false;
    const recoveredCaptures = new Set<string>();
    const abort = new AbortController();
    const flush = async () => {
      if (!actorId) return;
      const result = await flushInterviewAudio(roundId, actorId);
      if (!disposed) {
        setPendingCount(result.pending);
        if (result.error) setError(result.error);
      }
      if (result.pending || result.error)
        throw new Error(
          result.error ??
            "Audio is still waiting to upload. Keep this page open and retry.",
        );
    };
    const stop = async () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      const previous = recorder;
      recorder = null;
      captureId = null;
      if (previous && previous.state !== "inactive") previous.stop();
      if (!disposed) setRecording(false);
      // onstop publishes a promise synchronously in browsers only after its final
      // data event, so stop completion is tracked independently below.
      await finished;
      await saved.catch(() => undefined);
    };
    let finished = Promise.resolve();
    const start = (ticket: InterviewMediaTicket) => {
      if (
        !actorId ||
        !ticket.captureId ||
        !ticket.attemptId ||
        disposed ||
        finishing.current
      )
        return;
      if (recoveredCaptures.has(ticket.captureId)) {
        setError(
          "A partial recording was recovered after reloading. This station keeps that take; recording cannot resume without a new take.",
        );
        return;
      }
      if (typeof MediaRecorder === "undefined")
        throw new Error("Audio recording is not supported in this browser.");
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType)
        throw new Error(
          "This browser cannot record audio. Use a supported browser or continue without recording.",
        );
      const selectedCapture = ticket.captureId;
      const selectedActor = actorId;
      const selectedAttempt = ticket.attemptId;
      const clockOffset = ticket.serverNow
        ? Date.parse(ticket.serverNow) - Date.now()
        : 0;
      const startedAt = new Date(Date.now() + clockOffset).toISOString();
      const chunks: Blob[] = [];
      let bytes = 0;
      let resolveFinished!: () => void;
      const instance = new MediaRecorder(micStream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      finished = new Promise<void>((resolve) => {
        resolveFinished = resolve;
      });
      let sequence = 0;
      const persist = (blob: Blob, complete: boolean) => {
        if (!blob.size) return;
        const chunkSequence = sequence++;
        const value = {
          id: selectedCapture,
          actorId: selectedActor,
          roundId,
          attemptId: selectedAttempt,
          captureId: selectedCapture,
          createdAt: Date.now(),
          startedAt,
          blob,
          complete,
        };
        saved = saved
          .catch(() => undefined)
          .then(() =>
            complete
              ? saveInterviewAudio(value)
              : appendInterviewAudio(value, chunkSequence),
          );
        void saved.catch(() => {
          if (!disposed)
            setError(
              "Local recovery is unavailable. Keep this page open until audio uploads.",
            );
        });
      };
      instance.ondataavailable = (event) => {
        if (event.data.size) {
          const chunk = event.data.slice(0, event.data.size, mimeType);
          chunks.push(chunk);
          bytes += chunk.size;
          persist(chunk, false);
          if (bytes >= stopBytes && instance.state !== "inactive") {
            setError(
              "The recording reached its size limit. This take has ended.",
            );
            instance.stop();
          }
        }
      };
      instance.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        persist(blob, true);
        if (blob.size > maximumBytes) {
          setError(
            "This recording exceeds the upload limit. Download a copy to keep it safe; it also remains on this device.",
          );
          setDownloadRecording(() => () => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `interview-${roundId}.${mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm"}`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          });
        }
        resolveFinished();
        if (recorder === instance) {
          recorder = null;
          captureId = null;
          finishing.current = true;
          micStream.getTracks().forEach((track) => {
            track.enabled = false;
          });
          if (!disposed) setRecording(false);
          void saved.then(flush).catch(() => undefined);
        }
      };
      instance.onerror = () => {
        if (!disposed)
          setError(
            "Audio recording failed. You can continue the interview and retry.",
          );
      };
      recorder = instance;
      captureId = selectedCapture;
      try {
        instance.start(5_000);
      } catch (failure) {
        resolveFinished();
        throw failure;
      }
      setRecording(true);
      if (ticket.captureExpiresAt)
        expiryTimer = setTimeout(
          () => {
            void stop()
              .then(flush)
              .catch(() => undefined);
          },
          Math.max(
            0,
            Date.parse(ticket.captureExpiresAt) - Date.now() - clockOffset,
          ),
        );
    };
    const poll = async () => {
      if (disposed) return;
      if (polling) {
        refreshAgain = true;
        return;
      }
      polling = true;
      try {
        const response = await fetch(
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/media?capture=1`,
          { cache: "no-store", signal: abort.signal },
        );
        if (!response.ok)
          throw new Error(
            "Unable to verify recording access. The microphone is paused until connection returns.",
          );
        const ticket = (await response.json()) as InterviewMediaTicket;
        if (disposed) return;
        actorId = ticket.actorId ?? null;
        if (actorId && !recovered) {
          recovered = true;
          for (const id of await recoverInterviewAudio(roundId, actorId))
            recoveredCaptures.add(id);
          await flush().catch(() => undefined);
        } else if (actorId) void flush().catch(() => undefined);
        if (disposed) return;
        const offset = ticket.serverNow
          ? Date.parse(ticket.serverNow) - Date.now()
          : 0;
        const matchingPhase =
          !ticket.phase || ticket.phase === latest.current.phase;
        const allowed =
          matchingPhase &&
          latest.current.enabled &&
          ticket.recordingEnabled &&
          !finishing.current &&
          (!ticket.expiresAt ||
            Date.parse(ticket.expiresAt) > Date.now() + offset);
        setServerRecording(allowed);
        audible.current = matchingPhase && (allowed || !recorder);
        if (authorizationTimer) clearTimeout(authorizationTimer);
        if (ticket.expiresAt && allowed)
          authorizationTimer = setTimeout(
            () => {
              audible.current = false;
              micStream.getTracks().forEach((track) => {
                track.enabled = false;
              });
              setServerRecording(false);
              void poll();
            },
            Math.max(0, Date.parse(ticket.expiresAt) - Date.now() - offset),
          );
        // A missing policy never leaves an audible track on an existing encoder.
        micStream.getTracks().forEach((track) => {
          track.enabled =
            latest.current.microphoneEnabled &&
            latest.current.enabled &&
            audible.current;
        });
        if (recorder && captureId !== ticket.captureId) {
          await stop();
          void flush().catch(() => undefined);
        }
        if (!recorder && allowed && ticket.captureId) start(ticket);
        if (ticket.warning) setError(ticket.warning);
      } catch (failure) {
        audible.current = false;
        micStream.getTracks().forEach((track) => {
          track.enabled = false;
        });
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : "Audio recording unavailable.",
          );
      } finally {
        polling = false;
        if (!disposed) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(
            () => {
              void poll();
            },
            refreshAgain ? 0 : 10_000,
          );
          refreshAgain = false;
        }
      }
    };
    refresh.current = () => {
      void poll();
    };
    finalize.current = async () => {
      finishing.current = true;
      micStream.getTracks().forEach((track) => {
        track.enabled = false;
      });
      setMicrophoneEnabled(false);
      await stop();
      await flush();
    };
    void poll();
    return () => {
      disposed = true;
      abort.abort();
      if (timer) clearTimeout(timer);
      if (authorizationTimer) clearTimeout(authorizationTimer);
      refresh.current = () => undefined;
      void stop()
        .then(flush)
        .catch(() => undefined);
    };
  }, [roundId, micStream]);
  const toggle = () => {
    const next = !microphoneEnabled;
    setMicrophoneEnabled(next);
    micStream?.getTracks().forEach((track) => {
      track.enabled = next && enabled && audible.current;
    });
  };
  return {
    microphoneEnabled,
    micStream,
    recording,
    serverRecording,
    pendingCount,
    downloadRecording,
    error,
    toggle,
    retryCapture: () => {
      setError("");
      if (micStream) refresh.current();
      else {
        finishing.current = false;
        setRetry((value) => value + 1);
      }
    },
  };
}
