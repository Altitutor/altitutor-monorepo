"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import type {
  InterviewDelivery,
  InterviewMediaTicket,
  InterviewPhase,
} from "@altitutor/shared";
import { Camera, CameraOff, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "./button";
import { InterviewAudioRecorder } from "./interview-audio-recorder";

export interface InterviewMediaProps {
  roundId: string;
  phase: InterviewPhase;
  delivery: InterviewDelivery;
  enabled: boolean;
  role?: "tutor" | "student";
}

function ParticipantMedia({ participant }: { participant: DailyParticipant }) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const videoTrack =
    participant.tracks.video.state === "playable"
      ? participant.tracks.video.persistentTrack
      : undefined;
  const audioTrack =
    participant.tracks.audio.state === "playable"
      ? participant.tracks.audio.persistentTrack
      : undefined;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = videoTrack ? new MediaStream([videoTrack]) : null;
    if (videoTrack) void element.play().catch(() => undefined);
    return () => {
      element.srcObject = null;
    };
  }, [videoTrack]);
  useEffect(() => {
    const element = audio.current;
    if (!element || participant.local) return;
    element.srcObject = audioTrack ? new MediaStream([audioTrack]) : null;
    if (audioTrack)
      void element
        .play()
        .then(() => setSoundBlocked(false))
        .catch(() => setSoundBlocked(true));
    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [audioTrack, participant.local]);
  return (
    <div className="relative overflow-hidden rounded-lg bg-slate-950">
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        aria-label={
          participant.local
            ? "Your video preview"
            : `${participant.user_name || "Participant"} video`
        }
        className={`aspect-video w-full object-cover ${participant.local ? "-scale-x-100" : ""}`}
      />
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <CameraOff className="h-8 w-8" aria-hidden />
        </div>
      )}
      {!participant.local && <audio ref={audio} autoPlay />}
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
        {participant.local ? "You" : participant.user_name || "Participant"}
      </span>
      {soundBlocked && (
        <Button
          className="absolute right-2 top-2"
          size="sm"
          variant="secondary"
          onClick={() => {
            void audio.current
              ?.play()
              .then(() => setSoundBlocked(false))
              .catch(() => setSoundBlocked(true));
          }}
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Enable sound
        </Button>
      )}
    </div>
  );
}

/** Private pair calls use server-issued policy/tokens. UI hiding is additional protection. */
export function InterviewMedia({
  roundId,
  phase,
  delivery,
  enabled,
  role = "student",
}: InterviewMediaProps) {
  const [devicesRequested, setDevicesRequested] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const devicePreferences = useRef({ micOn, cameraOn });
  devicePreferences.current = { micOn, cameraOn };
  const callRef = useRef<DailyCall | null>(null);
  const closing = useRef<Promise<void>>(Promise.resolve());
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [ticket, setTicket] = useState<InterviewMediaTicket | null>(null);
  const [status, setStatus] = useState("Your camera and microphone are off.");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const scope = `${roundId}:${phase}:${enabled}:${devicesRequested}:${retry}`;
  const [renderScope, setRenderScope] = useState(scope);
  const current = renderScope === scope;

  useEffect(() => {
    if (delivery === "in_person") return;
    let disposed = false;
    let call: DailyCall | null = null;
    let sessionId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let activeTicket: InterviewMediaTicket | null = null;
    let clockOffset = 0;
    const abort = new AbortController();
    setRenderScope(scope);
    setParticipants([]);
    setTicket(null);
    setError("");
    setStatus(
      devicesRequested
        ? "Preparing your devices…"
        : "Your camera and microphone are off.",
    );

    const close = async () => {
      const previous = call;
      call = null;
      sessionId = null;
      if (callRef.current === previous) callRef.current = null;
      if (!disposed) setParticipants([]);
      if (!previous) return;
      // Stop capture synchronously, before awaiting provider cleanup or another join.
      try {
        previous.setLocalAudio(false);
        previous.setLocalVideo(false);
        for (const participant of Object.values(previous.participants())) {
          if (!participant.local) continue;
          participant.tracks.audio.persistentTrack?.stop();
          participant.tracks.video.persistentTrack?.stop();
        }
      } catch {
        /* A provider event may already have destroyed the call. */
      }
      await previous.destroy().catch(() => undefined);
      if (!disposed) setParticipants([]);
    };
    const updateParticipants = () => {
      if (!disposed && call)
        setParticipants(Object.values(call.participants()));
    };
    const create = async () => {
      if (call) return call;
      await closing.current;
      const { default: Daily } = await import("@daily-co/daily-js");
      if (disposed) return null;
      const instance = Daily.createCallObject({
        subscribeToTracksAutomatically: false,
        startAudioOff: true,
        startVideoOff: true,
      });
      call = instance;
      callRef.current = instance;
      instance
        .on("participant-joined", updateParticipants)
        .on("participant-updated", updateParticipants)
        .on("participant-left", updateParticipants)
        .on("track-started", updateParticipants)
        .on("track-stopped", updateParticipants);
      instance.on("network-connection", () => {
        if (!disposed) setStatus("Checking call connection…");
      });
      instance.on("joined-meeting", () => {
        if (!disposed) setStatus("Connected to your station.");
      });
      instance.on("left-meeting", () => {
        if (!disposed) {
          sessionId = null;
          setStatus("Reconnecting to your station…");
        }
      });
      instance.on("error", () => {
        if (!disposed) {
          setError("The call was interrupted. Reconnecting automatically.");
          void close();
        }
      });
      instance.on("camera-error", () => {
        if (!disposed)
          setError(
            "Camera or microphone unavailable. Check browser permissions and try again.",
          );
      });
      if (devicesRequested) {
        await instance.startCamera({
          startAudioOff: !devicePreferences.current.micOn,
          startVideoOff: !devicePreferences.current.cameraOn,
        });
        if (disposed) {
          await close();
          return null;
        }
        updateParticipants();
      }
      return instance;
    };
    const poll = async () => {
      try {
        const query = sessionId
          ? `?sessionId=${encodeURIComponent(sessionId)}`
          : "";
        const response = await fetch(
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/media${query}`,
          { cache: "no-store", signal: abort.signal },
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          await close();
          throw new Error(
            body && typeof body === "object" && "error" in body
              ? String(body.error)
              : "Unable to connect to interview media.",
          );
        }
        if (disposed) return;
        const policy = body as InterviewMediaTicket;
        clockOffset = policy.serverNow
          ? Date.parse(policy.serverNow) - Date.now()
          : 0;
        activeTicket = policy;
        setTicket(policy);
        setError("");
        if (
          !enabled ||
          !policy.sessionId ||
          (policy.expiresAt &&
            Date.parse(policy.expiresAt) <= Date.now() + clockOffset)
        ) {
          if (sessionId) await close();
          if (!enabled) {
            await close();
            setStatus("Audio and video are paused.");
          } else if (devicesRequested) {
            await create();
            setStatus("Only your local preview is active.");
          }
          return;
        }
        if (sessionId && sessionId !== policy.sessionId) await close();
        const instance = await create();
        if (!instance || disposed) return;
        if (expiryTimer) clearTimeout(expiryTimer);
        if (policy.expiresAt) {
          expiryTimer = setTimeout(
            () => {
              if (disposed) return;
              activeTicket = null;
              setTicket(null);
              setParticipants([]);
              setStatus("Waiting for the next phase…");
              closing.current = close();
            },
            Math.max(
              0,
              Date.parse(policy.expiresAt) - Date.now() - clockOffset,
            ),
          );
        }
        instance.setSubscribeToTracksAutomatically(policy.canReceive);
        instance.setLocalAudio(
          devicesRequested && policy.canSend && devicePreferences.current.micOn,
        );
        instance.setLocalVideo(
          devicesRequested &&
            policy.canSend &&
            devicePreferences.current.cameraOn,
        );
        if (sessionId !== policy.sessionId) {
          if (!policy.url || !policy.token)
            throw new Error("A fresh call connection is required. Retrying…");
          setStatus("Connecting to your station…");
          await instance.join({
            url: policy.url,
            token: policy.token,
            startAudioOff: !(
              devicesRequested &&
              policy.canSend &&
              devicePreferences.current.micOn
            ),
            startVideoOff: !(
              devicesRequested &&
              policy.canSend &&
              devicePreferences.current.cameraOn
            ),
          });
          if (disposed) {
            await close();
            return;
          }
          if (instance !== call) return;
          sessionId = policy.sessionId;
        }
        updateParticipants();
      } catch (failure) {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to connect to interview media.",
          );
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, 3_000);
      }
    };
    void (async () => {
      await closing.current;
      if (disposed) return;
      if (devicesRequested && enabled) {
        try {
          await create();
        } catch {
          if (!disposed)
            setError(
              "Camera or microphone unavailable. Check browser permissions and try again.",
            );
        }
      }
      if (!disposed) void poll();
    })();
    const changeVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        activeTicket?.expiresAt &&
        Date.parse(activeTicket.expiresAt) <= Date.now() + clockOffset
      ) {
        activeTicket = null;
        setTicket(null);
        closing.current = close();
      }
    };
    document.addEventListener("visibilitychange", changeVisibility);
    return () => {
      disposed = true;
      abort.abort();
      if (timer) clearTimeout(timer);
      if (expiryTimer) clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", changeVisibility);
      closing.current = close();
    };
  }, [roundId, phase, delivery, enabled, devicesRequested, retry, scope]);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    callRef.current?.setLocalAudio(
      next && enabled && (!ticket?.sessionId || ticket.canSend),
    );
  };
  const toggleCamera = () => {
    const next = !cameraOn;
    setCameraOn(next);
    callRef.current?.setLocalVideo(
      next && enabled && (!ticket?.sessionId || ticket.canSend),
    );
  };
  if (delivery === "in_person" && role === "tutor")
    return (
      <InterviewAudioRecorder
        roundId={roundId}
        phase={phase}
        enabled={enabled}
      />
    );
  if (delivery === "in_person")
    return (
      <p className="text-sm text-muted-foreground">
        Meet your tutor at the station. Online video is not used for in-person
        interviews.
      </p>
    );
  const visible = current
    ? participants.filter(
        (participant) => participant.local || (enabled && ticket?.canReceive),
      )
    : [];
  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {visible.map((participant) => (
          <ParticipantMedia
            key={participant.session_id}
            participant={participant}
          />
        ))}
        {!visible.length && (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
            <CameraOff className="h-8 w-8 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {current ? status : "Updating your station…"}
      </p>
      {current && ticket?.sessionId && !ticket.canReceive && (
        <p className="text-xs text-muted-foreground">
          You will see and hear your tutor when question time starts.
        </p>
      )}
      {current && ticket?.recordingEnabled && (
        <p className="text-xs font-medium">
          {ticket.recordingActive
            ? phase === "feedback"
              ? "Recording feedback"
              : "Recording this answer"
            : "Recording is preparing"}
        </p>
      )}
      {current && ticket?.warning && (
        <p role="alert" className="rounded-md bg-amber-500/10 p-3 text-sm">
          {ticket.warning}
        </p>
      )}
      {current && error && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-amber-500/40 p-3"
        >
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reconnect
          </Button>
        </div>
      )}
      {enabled && !devicesRequested ? (
        <Button variant="outline" onClick={() => setDevicesRequested(true)}>
          <Camera className="mr-2 h-4 w-4" />
          Enable camera and microphone
        </Button>
      ) : (
        devicesRequested && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!enabled}
              onClick={toggleMic}
              aria-pressed={micOn}
            >
              {micOn ? (
                <Mic className="mr-2 h-4 w-4" />
              ) : (
                <MicOff className="mr-2 h-4 w-4" />
              )}
              {micOn ? "Mute" : "Unmute"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!enabled}
              onClick={toggleCamera}
              aria-pressed={cameraOn}
            >
              {cameraOn ? (
                <Camera className="mr-2 h-4 w-4" />
              ) : (
                <CameraOff className="mr-2 h-4 w-4" />
              )}
              {cameraOn ? "Camera off" : "Camera on"}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
