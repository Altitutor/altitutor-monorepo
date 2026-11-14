"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Circle, Loader2, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useMediaDeviceTest } from "../hooks/use-media-device-test";
import { Button } from "./button";

function clipTime(seconds: number) {
  return `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
}

function MicrophoneLevel({ stream, paused }: { stream: MediaStream | null; paused: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || paused) { setLevel(0); return; }
    const AudioCtor = globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    let context: AudioContext | undefined;
    let frame = 0;
    try {
      context = new AudioCtor();
      void context.resume().catch(() => undefined);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;
      const tick = (time: number) => {
        if (time - lastUpdate >= 80) {
          lastUpdate = time;
          analyser.getByteTimeDomainData(data);
          let energy = 0;
          for (const value of data) energy += ((value - 128) / 128) ** 2;
          setLevel(Math.min(100, Math.sqrt(energy / data.length) * 300));
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      // Recording remains available when the browser cannot draw a level meter.
    }
    return () => {
      cancelAnimationFrame(frame);
      void context?.close().catch(() => undefined);
    };
  }, [stream, paused]);
  return (
    <div className="flex h-8 items-center gap-1" aria-label="Microphone input level">
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index} aria-hidden className={`h-5 flex-1 rounded-sm ${stream && !paused && index < level * 0.24 ? "bg-emerald-500" : "bg-muted"}`} />
      ))}
    </div>
  );
}

/** Local-only device check shared by portal settings and interview waiting rooms. */
export function MediaDeviceTest() {
  const test = useMediaDeviceTest();
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const { camera, microphone } = test.streams;
  useEffect(() => {
    const media = audio.current;
    return () => {
      media?.pause();
      media?.removeAttribute("src");
      media?.load();
    };
  }, [test.clip?.url]);
  useEffect(() => {
    microphone?.getAudioTracks().forEach((track) => { track.enabled = !playing; });
  }, [microphone, playing]);
  const stopPlayback = () => {
    audio.current?.pause();
    setPlaying(false);
    setPlaybackError("");
  };
  const inputSelector = (kind: "camera" | "microphone") => {
    const stream = test.streams[kind];
    const options = test.devices.filter((device) =>
      device.kind === (kind === "camera" ? "videoinput" : "audioinput") && device.deviceId,
    );
    const selected = stream?.getTracks()[0]?.getSettings().deviceId ?? "";
    const label = kind === "camera" ? "Camera" : "Microphone";
    return (
      <label className="block space-y-2 text-sm">
        <span className="font-medium">{label}</span>
        <select
          aria-label={`${label} input`}
          value={selected}
          disabled={!stream || test.pending[kind] || (kind === "microphone" && (test.recording || playing))}
          onChange={(event) => void test.startInput(kind, event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Browser default</option>
          {options.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
    );
  };
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 md:grid-cols-2">
        <section aria-label="Camera test" className="overflow-hidden rounded-xl border bg-card">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted">
            {camera ? (
              <video
                aria-label="Camera test preview"
                autoPlay muted playsInline
                ref={(node) => { if (node && node.srcObject !== camera) node.srcObject = camera; }}
                className="h-full w-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 text-center text-muted-foreground">
                <Camera className="size-8" strokeWidth={1.5} aria-hidden />
                <p className="text-sm">See how you look before you join.</p>
              </div>
            )}
            {camera && <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">Only visible to you</span>}
          </div>
          <div className="space-y-4 p-5">
            {inputSelector("camera")}
            {test.errors.camera && <p role="alert" className="text-sm text-destructive">{test.errors.camera}</p>}
            <Button type="button" variant="outline" disabled={test.pending.camera}
              onClick={() => camera ? test.stopInput("camera") : void test.startInput("camera")}>
              {test.pending.camera ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
              {test.pending.camera ? "Starting camera…" : camera ? "Stop camera" : "Test camera"}
            </Button>
          </div>
        </section>

        <section aria-label="Microphone test" className="space-y-5 rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><Mic className="size-5" aria-hidden /></span>
            <div className="space-y-1">
              <h3 className="font-semibold">Hear yourself back</h3>
              <p className="text-sm text-muted-foreground">Record a short clip to check your voice and background noise.</p>
            </div>
          </div>
          {inputSelector("microphone")}
          <div>
            <MicrophoneLevel stream={microphone} paused={playing} />
            <p className="text-xs text-muted-foreground">{playing ? "Microphone muted during playback" : microphone ? "Speak to check the input level" : "Enable your microphone to begin"}</p>
          </div>
          {test.errors.microphone && <p role="alert" className="text-sm text-destructive">{test.errors.microphone}</p>}
          {!microphone ? (
            <Button type="button" variant="outline" disabled={test.pending.microphone}
              onClick={() => void test.startInput("microphone")}>
              {test.pending.microphone ? <Loader2 className="animate-spin" aria-hidden /> : <Mic aria-hidden />}
              {test.pending.microphone ? "Starting microphone…" : "Enable microphone"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={test.pending.microphone}
                onClick={() => {
                  stopPlayback();
                  if (test.recording) test.stopRecording();
                  else test.startRecording();
                }}>
                {test.recording ? <Square className="size-3 fill-current" aria-hidden /> : <Circle className="size-3 fill-current" aria-hidden />}
                {test.recording ? "Stop recording" : test.clip ? "Record again" : "Record test clip"}
              </Button>
              {test.recording ? (
                <span role="timer" aria-label="Test recording duration" className="text-sm tabular-nums">{clipTime(test.seconds)} / 0:30</span>
              ) : (
                <Button type="button" variant="ghost" onClick={() => { stopPlayback(); test.stopInput("microphone"); }}>Stop microphone</Button>
              )}
            </div>
          )}
          {test.recording && <p role="status" className="text-xs text-muted-foreground">Recording… Speak normally, then stop and listen.</p>}
          {test.clip && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Your test clip</span>
                <span className="text-xs tabular-nums text-muted-foreground">{clipTime(test.clip.seconds)}</span>
              </div>
              <audio key={test.clip.url} ref={audio} src={test.clip.url} className="hidden"
                onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)}
                onError={() => { setPlaying(false); setPlaybackError("This clip could not play. Record another to try again."); }} />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => {
                    const media = audio.current;
                    if (!media) return;
                    if (playing) stopPlayback();
                    else {
                      setPlaybackError("");
                      media.currentTime = 0;
                      setPlaying(true);
                      void media.play().catch(() => {
                        setPlaying(false);
                        setPlaybackError("Playback could not start. Press Play clip to try again.");
                      });
                    }
                  }}>
                  {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                  {playing ? "Stop playback" : "Play clip"}
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Delete test clip"
                  onClick={() => { stopPlayback(); test.discard(); }}><Trash2 aria-hidden /></Button>
              </div>
              {playbackError && <p role="alert" className="text-sm text-destructive">{playbackError}</p>}
            </div>
          )}
        </section>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Test clips stay on this page. Recording again replaces the clip, and leaving the test deletes it. Each clip can be up to 30 seconds.
      </p>
    </div>
  );
}
