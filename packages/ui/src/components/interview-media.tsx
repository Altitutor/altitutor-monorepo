"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import type {
  InterviewCallFailure,
  InterviewDelivery,
  InterviewMediaTicket,
  InterviewPhase,
} from "@altitutor/shared";
import {
  Camera,
  CameraOff,
  Columns,
  MicOff,
  PictureInPicture,
  Volume2,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { InterviewAudioRecorder } from "./interview-audio-recorder";
import {
  InterviewDeviceSettings,
  type InterviewInputSelection,
} from "./interview-device-settings";
import { reportLocalCallFailure } from "./interview-media-diagnostics";
import {
  InterviewVideoStage,
  type InterviewVideoView,
} from "./interview-video-stage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export interface InterviewMediaProps {
  onCallFailure?: (failure: InterviewCallFailure) => void;
  roundId: string;
  phase: InterviewPhase;
  delivery: InterviewDelivery;
  enabled: boolean;
  role?: "tutor" | "student";
  plain?: boolean;
  className?: string;
  registerFinalize?: (finalize: (() => Promise<void>) | null) => void;
}

const blockedMediaMessage =
  "This browser is blocking camera and microphone access. On iPad, open the interview in Safari, allow Camera and Microphone for this site, and turn off Lockdown Mode.";
const deviceDeniedMessage =
  "Camera or microphone unavailable. Check browser permissions and try again.";

type DeviceAccess = "granted" | "denied" | "needs-gesture" | "unsupported";

function permissionState(name: "camera" | "microphone") {
  const query = navigator.permissions?.query?.bind(navigator.permissions);
  if (!query) return Promise.resolve("unknown");
  return query({ name: name as PermissionName })
    .then((status) => status.state)
    .catch(() => "unknown");
}

let deviceCapture: Promise<DeviceAccess> | null = null;
// Daily permits one call object per page. A new layout owner must also await
// teardown from an unmounted waiting-room/previous-round owner.
let dailyClosing = Promise.resolve();

/** Ask for the camera and microphone. A shared request avoids two prompts from one join. */
function captureDevices() {
  if (!deviceCapture) {
    deviceCapture = (async (): Promise<DeviceAccess> => {
      prepareMediaDevices();
      const request = navigator.mediaDevices?.getUserMedia?.bind(
        navigator.mediaDevices,
      );
      if (!request) return "unsupported";
      try {
        const stream = await request({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        return "granted";
      } catch (error) {
        const blocked =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError");
        if (!blocked) return "denied";
        const states = await Promise.all([
          permissionState("camera"),
          permissionState("microphone"),
        ]);
        return states.includes("denied") ? "denied" : "needs-gesture";
      }
    })().finally(() => {
      deviceCapture = null;
    });
  }
  return deviceCapture;
}

function MicLevelIcon({
  track,
  muted,
}: {
  track: MediaStreamTrack | null;
  muted: boolean;
}) {
  const clipId = React.useId().replace(/:/g, "");
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track || muted || track.readyState !== "live") {
      setLevel(0);
      return;
    }
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let disposed = false;
    let frame = 0;
    const cleanup = () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      try {
        source?.disconnect();
      } catch {
        /* Already disconnected. */
      }
      try {
        void context?.close().catch(() => undefined);
      } catch {
        /* Already closed. */
      }
    };
    try {
      context = new AudioContextCtor();
      source = context.createMediaStreamSource(new MediaStream([track]));
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let shown = 0;
      const tick = () => {
        if (disposed) return;
        try {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const value of samples) {
            const sample = (value - 128) / 128;
            sum += sample * sample;
          }
          const next = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          shown = next > shown ? next : shown * 0.8;
          const bucket = Math.round(shown * 16) / 16;
          setLevel((current) => (current === bucket ? current : bucket));
          frame = requestAnimationFrame(tick);
        } catch {
          cleanup();
        }
      };
      void context
        .resume()
        .then(() => {
          if (!disposed) frame = requestAnimationFrame(tick);
        })
        .catch(cleanup);
    } catch {
      // The level meter is decorative; Web Audio failures must not stop calls.
      cleanup();
    }
    return cleanup;
  }, [muted, track]);
  const filled = 10 * (muted ? 0 : level);
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 19v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <clipPath id={clipId}>
        <rect x="8" y={12 - filled} width="8" height={filled} />
      </clipPath>
      <path
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        clipPath={`url(#${clipId})`}
        fill="currentColor"
      />
    </svg>
  );
}

function prepareMediaDevices() {
  type LegacyGetUserMedia = (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    failure: (error: Error) => void,
  ) => void;
  const nav = navigator as Navigator & {
    webkitGetUserMedia?: LegacyGetUserMedia;
    getUserMedia?: LegacyGetUserMedia;
  };
  if (typeof nav.mediaDevices?.getUserMedia === "function") return true;
  const legacy = nav.webkitGetUserMedia ?? nav.getUserMedia;
  if (!legacy) return false;
  const devices = nav.mediaDevices ?? ({} as MediaDevices);
  try {
    if (!nav.mediaDevices)
      Object.defineProperty(nav, "mediaDevices", {
        configurable: true,
        value: devices,
      });
  } catch {
    return false;
  }
  try {
    nav.mediaDevices.getUserMedia = (constraints) =>
      new Promise((resolve, reject) => {
        legacy.call(
          nav,
          constraints ?? { audio: true, video: true },
          resolve,
          reject,
        );
      });
  } catch {
    return false;
  }
  return typeof nav.mediaDevices.getUserMedia === "function";
}

function mediaError(failure: unknown) {
  const message =
    failure instanceof Error
      ? failure.message
      : "Unable to connect to interview media.";
  return message.includes("WebRTC not supported")
    ? blockedMediaMessage
    : message;
}

function MediaControl({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(
            "rounded-full text-white hover:bg-white/20 hover:text-white",
            pressed === false && "bg-red-600 text-white hover:bg-red-500",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
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
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-950">
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
        className={`h-full w-full object-contain ${participant.local ? "-scale-x-100" : ""}`}
      />
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <CameraOff className="h-8 w-8" aria-hidden />
        </div>
      )}
      {!participant.local && <audio ref={audio} autoPlay />}
      <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
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
  plain = false,
  className,
  registerFinalize,
  onCallFailure,
}: InterviewMediaProps) {
  const failureReporter = useRef(onCallFailure);
  failureReporter.current = onCallFailure;
  const [devicesRequested, setDevicesRequested] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [videoView, setVideoView] = useState<InterviewVideoView>("pip");
  const devicePreferences = useRef({ micOn, cameraOn });
  devicePreferences.current = { micOn, cameraOn };
  const callRef = useRef<DailyCall | null>(null);
  const inputSelection = useRef<InterviewInputSelection>({
    audio: "",
    video: "",
  });
  const closing = useRef<Promise<void>>(Promise.resolve());
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [ticket, setTicket] = useState<InterviewMediaTicket | null>(null);
  const [status, setStatus] = useState("Preparing your devices…");
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
    let consecutiveFailures = 0;
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
      const destroyed = Promise.resolve()
        .then(() => previous.destroy())
        .catch(() => undefined);
      dailyClosing = Promise.all([dailyClosing, destroyed]).then(
        () => undefined,
      );
      await destroyed;
      if (!disposed) setParticipants([]);
    };
    const updateParticipants = () => {
      if (!disposed && call)
        setParticipants(Object.values(call.participants()));
    };
    const create = async () => {
      if (call) return call;
      await closing.current;
      await dailyClosing;
      prepareMediaDevices();
      const { default: Daily } = await import("@daily-co/daily-js");
      if (disposed) return null;
      let instance: DailyCall;
      try {
        instance = Daily.createCallObject({
          subscribeToTracksAutomatically: false,
          startAudioOff: true,
          startVideoOff: true,
          ...(inputSelection.current.audio || inputSelection.current.video
            ? {
                inputSettings: {
                  ...(inputSelection.current.audio
                    ? {
                        audio: {
                          settings: { deviceId: inputSelection.current.audio },
                        },
                      }
                    : {}),
                  ...(inputSelection.current.video
                    ? {
                        video: {
                          settings: { deviceId: inputSelection.current.video },
                        },
                      }
                    : {}),
                },
              }
            : {}),
        });
      } catch (failure) {
        throw new Error(mediaError(failure));
      }
      call = instance;
      callRef.current = instance;
      const interruptedConnections = new Set<string>();
      instance
        .on("participant-joined", updateParticipants)
        .on("participant-updated", updateParticipants)
        .on("participant-left", updateParticipants)
        .on("track-started", updateParticipants)
        .on("track-stopped", updateParticipants);
      instance.on("network-connection", ({ type, event }) => {
        if (disposed || instance !== call) return;
        if (event === "interrupted") interruptedConnections.add(type);
        else if (event === "connected") interruptedConnections.delete(type);
        else return;
        setStatus(
          interruptedConnections.size ? "Reconnecting to your station…" : "",
        );
      });
      instance.on("joined-meeting", () => {
        if (!disposed && instance === call)
          setStatus(
            interruptedConnections.size ? "Reconnecting to your station…" : "",
          );
      });
      instance.on("left-meeting", () => {
        if (!disposed) {
          sessionId = null;
          setStatus("Reconnecting to your station…");
        }
      });
      instance.on("error", (event) => {
        if (!disposed && instance === call) {
          const category = event.error?.type;
          const plannedExpiry =
            activeTicket?.expiresAt &&
            Date.parse(activeTicket.expiresAt) <=
              Date.now() + clockOffset + 1_000 &&
            (category === "ejected" ||
              category === "exp-token" ||
              category === "exp-room");
          // Server-controlled early cutoff can eject before the new phase reaches React.
          // If an unexpected ejection prevents rejoining, sustained recovery reports it.
          if (enabled && !plannedExpiry && category !== "ejected") {
            try {
              failureReporter.current?.({
                source: "sdk",
                category:
                  category === "connection-error"
                    ? "connection"
                    : [
                          "nbf-room",
                          "nbf-token",
                          "no-room",
                          "meeting-full",
                          "end-of-life",
                          "not-allowed",
                          "exp-token",
                          "exp-room",
                        ].includes(category ?? "")
                      ? "configuration"
                      : "unknown",
                phase,
                state: sessionId ? "joined" : "joining",
              });
            } catch {
              /* Observability must never alter call recovery. */
            }
          }
          reportLocalCallFailure(
            event.error?.type,
            instance !== call ? "obsolete" : sessionId ? "joined" : "joining",
          );
          setError("The call was interrupted. Reconnecting automatically.");
          void close();
        }
      });
      instance.on("camera-error", () => {
        if (!disposed) setError(deviceDeniedMessage);
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
      let nextPoll = 3_000;
      let source: "join" | "recovery" = "recovery";
      try {
        const query = sessionId
          ? `?sessionId=${encodeURIComponent(sessionId)}`
          : "";
        const response = await fetch(
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/media${query}`,
          { cache: "no-store", signal: abort.signal },
        );
        const body: unknown = await response.json();
        nextPoll = enabled ? 10_000 : 30_000;
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
          consecutiveFailures = 0;
          if (sessionId) await close();
          if (!enabled) {
            await close();
            setStatus("Audio and video are paused.");
          } else if (devicesRequested) {
            await create();
            setStatus("");
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
        if (sessionId !== policy.sessionId) {
          if (!policy.url || !policy.token)
            throw new Error("A fresh call connection is required. Retrying…");
          setStatus("Connecting to your station…");
          source = "join";
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
        // Daily only permits subscription updates after join has completed.
        // Keep the initial call unsubscribed until its server policy is applied.
        instance.setSubscribeToTracksAutomatically(policy.canReceive);
        instance.setLocalAudio(
          devicesRequested && policy.canSend && devicePreferences.current.micOn,
        );
        instance.setLocalVideo(
          devicesRequested &&
            policy.canSend &&
            devicePreferences.current.cameraOn,
        );
        updateParticipants();
        consecutiveFailures = 0;
      } catch (failure) {
        if (!disposed) {
          const expectedDevice =
            failure instanceof Error &&
            [
              "NotAllowedError",
              "SecurityError",
              "NotFoundError",
              "NotReadableError",
              "AbortError",
            ].includes(failure.name);
          if (expectedDevice) consecutiveFailures = 0;
          else if (enabled && ++consecutiveFailures === 3) {
            try {
              failureReporter.current?.({
                source,
                category: "unknown",
                phase,
                state: sessionId ? "joined" : "joining",
              });
            } catch {
              /* Observability must not change recovery. */
            }
          }
          setError(mediaError(failure));
        }
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, nextPoll);
      }
    };
    const openingDevices =
      devicesRequested && enabled ? captureDevices() : null;
    void (async () => {
      await closing.current;
      if (disposed) return;
      if (openingDevices) {
        const access = await openingDevices;
        if (disposed) return;
        if (access !== "granted") {
          setError(
            access === "denied"
              ? deviceDeniedMessage
              : access === "unsupported"
                ? blockedMediaMessage
                : "",
          );
          setDevicesRequested(false);
          return;
        }
        try {
          await create();
        } catch {
          if (!disposed) setError(deviceDeniedMessage);
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
        plain={plain}
        registerFinalize={registerFinalize}
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
  const localAudio =
    participants.find((participant) => participant.local)?.tracks.audio
      .persistentTrack ?? null;
  const localParticipant = visible.find((participant) => participant.local);
  const remoteParticipants = visible.filter(
    (participant) => !participant.local,
  );
  const requestDevices = () => {
    void captureDevices().then((access) => {
      if (access === "granted") {
        setError("");
        setDevicesRequested(true);
      } else if (access === "denied") setError(deviceDeniedMessage);
      else if (access === "unsupported") setError(blockedMediaMessage);
      else setError("");
    });
  };
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-slate-950",
        className,
      )}
    >
      <InterviewVideoStage
        view={videoView}
        localVideo={
          localParticipant ? (
            <ParticipantMedia participant={localParticipant} />
          ) : undefined
        }
        remoteVideo={
          remoteParticipants.length ? (
            <div
              className={cn(
                "grid h-full min-h-0",
                remoteParticipants.length > 1 && "grid-cols-2",
              )}
            >
              {remoteParticipants.map((participant) => (
                <ParticipantMedia
                  key={participant.session_id}
                  participant={participant}
                />
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 space-y-2">
          {(current ? status : "Updating your station…") ? (
            <p role="status" className="text-xs text-white/80">
              {current ? status : "Updating your station…"}
            </p>
          ) : null}
          {current && ticket?.sessionId && !ticket.canReceive && (
            <p className="text-xs text-white/80">
              You will see and hear your tutor when question time starts.
            </p>
          )}
          {current && ticket?.recordingEnabled && (
            <p className="text-xs font-medium text-white">
              {ticket.recordingActive
                ? phase === "feedback"
                  ? "Recording feedback"
                  : "Recording this answer"
                : "Recording is preparing"}
            </p>
          )}
          {current && ticket?.warning && (
            <p
              role="alert"
              className="rounded-md bg-amber-500/90 p-3 text-sm text-black"
            >
              {ticket.warning}
            </p>
          )}
          {current && error && (
            <div
              role="alert"
              className="pointer-events-auto space-y-2 rounded-md bg-black/80 p-3 text-white"
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
        </div>
      </InterviewVideoStage>
      {(enabled || devicesRequested) && (
        <div className="flex justify-center p-3">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-2">
              {enabled && !devicesRequested ? (
                <MediaControl
                  label="Enable camera and microphone"
                  onClick={requestDevices}
                >
                  <Camera />
                </MediaControl>
              ) : (
                <>
                  <MediaControl
                    label={micOn ? "Mute" : "Unmute"}
                    pressed={micOn}
                    disabled={!enabled}
                    onClick={toggleMic}
                  >
                    {micOn ? (
                      <MicLevelIcon track={localAudio} muted={!micOn} />
                    ) : (
                      <MicOff />
                    )}
                  </MediaControl>
                  <MediaControl
                    label={cameraOn ? "Turn camera off" : "Turn camera on"}
                    pressed={cameraOn}
                    disabled={!enabled}
                    onClick={toggleCamera}
                  >
                    {cameraOn ? <Camera /> : <CameraOff />}
                  </MediaControl>
                </>
              )}
              <MediaControl
                label={
                  videoView === "pip"
                    ? "Switch to side by side"
                    : "Switch to picture in picture"
                }
                onClick={() =>
                  setVideoView((previous) =>
                    previous === "pip" ? "side-by-side" : "pip",
                  )
                }
              >
                {videoView === "pip" ? <Columns /> : <PictureInPicture />}
              </MediaControl>
              <InterviewDeviceSettings
                call={callRef.current}
                callRef={callRef}
                selection={inputSelection}
                disabled={!current || !enabled || !devicesRequested}
                canSend={
                  current && enabled && (!ticket?.sessionId || ticket.canSend)
                }
                micOn={micOn}
                cameraOn={cameraOn}
              />
            </div>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
