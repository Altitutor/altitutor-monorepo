"use client";

import { useEffect, useRef, useState } from "react";
import { interviewMicrophoneConstraints } from "../lib/interview-microphone-constraints";

type Input = "camera" | "microphone";
const emptyInputs = { camera: null, microphone: null };
const clipLimitSeconds = 30;

function deviceError(reason: unknown) {
  if (reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "SecurityError")
      return "Allow access in your browser’s site settings, then try again.";
    if (reason.name === "NotFoundError")
      return "No device was found. Connect one, then try again.";
    if (reason.name === "NotReadableError")
      return "This device is busy. Close other apps using it, then try again.";
  }
  return "Unable to start this device. Check its connection and try again.";
}

/** Device streams and disposable clips belong only to this mounted test. */
export function useMediaDeviceTest() {
  const [streams, setStreams] = useState<Record<Input, MediaStream | null>>(emptyInputs);
  const [pending, setPending] = useState<Record<Input, boolean>>({ camera: false, microphone: false });
  const [errors, setErrors] = useState<Record<Input, string>>({ camera: "", microphone: "" });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ url: string; seconds: number } | null>(null);
  const currentStreams = useRef<Record<Input, MediaStream | null>>({ ...emptyInputs });
  const operations = useRef({ camera: 0, microphone: 0 });
  const mounted = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const clipUrl = useRef<string | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startedAt = useRef(0);

  const stopRecording = () => {
    clearInterval(clock.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };
  const discard = () => {
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    clipUrl.current = null;
    setClip(null);
  };
  const stopInput = (kind: Input) => {
    operations.current[kind]++;
    if (kind === "microphone") stopRecording();
    currentStreams.current[kind]?.getTracks().forEach((track) => track.stop());
    currentStreams.current[kind] = null;
    setStreams((previous) => ({ ...previous, [kind]: null }));
    setPending((previous) => ({ ...previous, [kind]: false }));
  };

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      void navigator.mediaDevices?.enumerateDevices().then((available) => {
        if (mounted.current) setDevices(available);
      }).catch(() => undefined);
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      mounted.current = false;
      operations.current.camera++;
      operations.current.microphone++;
      clearInterval(clock.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.ondataavailable = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      Object.values(currentStreams.current).forEach((stream) =>
        stream?.getTracks().forEach((track) => track.stop()),
      );
      currentStreams.current = { ...emptyInputs };
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
      clipUrl.current = null;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, []);

  const startInput = async (kind: Input, deviceId = "") => {
    stopInput(kind);
    const operation = operations.current[kind];
    setErrors((previous) => ({ ...previous, [kind]: "" }));
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrors((previous) => ({
        ...previous, [kind]: "Device access is unavailable. Open this page in a supported browser over a secure connection.",
      }));
      return;
    }
    setPending((previous) => ({ ...previous, [kind]: true }));
    const selection = deviceId ? { deviceId: { exact: deviceId } } : {};
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "camera"
          ? { video: { ...selection, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
          : { audio: { ...interviewMicrophoneConstraints, ...selection }, video: false },
      );
      if (!mounted.current || operation !== operations.current[kind]) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      currentStreams.current[kind] = stream;
      setStreams((previous) => ({ ...previous, [kind]: stream }));
      stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
        if (currentStreams.current[kind] !== stream || !mounted.current) return;
        stopInput(kind);
        setErrors((previous) => ({ ...previous, [kind]: "This device disconnected. Reconnect it and try again." }));
      }, { once: true }));
      const available = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (mounted.current) setDevices(available);
    } catch (reason) {
      if (mounted.current && operation === operations.current[kind])
        setErrors((previous) => ({ ...previous, [kind]: deviceError(reason) }));
    } finally {
      if (mounted.current && operation === operations.current[kind])
        setPending((previous) => ({ ...previous, [kind]: false }));
    }
  };

  const startRecording = () => {
    const stream = currentStreams.current.microphone;
    if (!stream || recorder.current?.state === "recording") return;
    setErrors((previous) => ({ ...previous, microphone: "" }));
    if (typeof MediaRecorder === "undefined") {
      setErrors((previous) => ({ ...previous, microphone: "This browser cannot record test clips. Try a current version of Safari, Chrome or Firefox." }));
      return;
    }
    try {
      const instance = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        clearInterval(clock.current);
        recorder.current = null;
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: instance.mimeType });
        if (!blob.size) {
          setErrors((previous) => ({ ...previous, microphone: "The clip was empty. Try recording again." }));
          return;
        }
        const duration = Math.min(clipLimitSeconds, (Date.now() - startedAt.current) / 1000);
        const url = URL.createObjectURL(blob);
        clipUrl.current = url;
        setClip({ url, seconds: duration });
      };
      instance.onerror = () => {
        stopRecording();
        setErrors((previous) => ({ ...previous, microphone: "Recording failed. Try another test clip." }));
      };
      instance.start();
      discard();
      recorder.current = instance;
      startedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
      clock.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(Math.min(elapsed, clipLimitSeconds));
        if (elapsed >= clipLimitSeconds) stopRecording();
      }, 200);
    } catch {
      setErrors((previous) => ({ ...previous, microphone: "Unable to record a clip. Stop and restart the microphone, then try again." }));
    }
  };

  return { streams, pending, errors, devices, recording, seconds, clip,
    startInput, stopInput, startRecording, stopRecording, discard };
}
