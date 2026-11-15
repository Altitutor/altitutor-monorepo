"use client";

import React, { useEffect, useState } from "react";

export function MicrophoneLevel({ stream, paused }: { stream: MediaStream | null; paused: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || paused) { setLevel(0); return; }
    const AudioCtor = globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let frame = 0;
    let disposed = false;
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      try { source?.disconnect(); } catch { /* Already disconnected. */ }
      try { void context?.close().catch(() => undefined); } catch { /* Already closed. */ }
    };
    try {
      context = new AudioCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;
      const tick = (time: number) => {
        if (disposed) return;
        try {
          if (time - lastUpdate >= 80) {
            lastUpdate = time;
            analyser.getByteTimeDomainData(data);
            let energy = 0;
            for (const value of data) energy += ((value - 128) / 128) ** 2;
            setLevel(Math.min(100, Math.sqrt(energy / data.length) * 300));
          }
          frame = requestAnimationFrame(tick);
        } catch { cleanup(); }
      };
      void context.resume().then(() => {
        if (!disposed) frame = requestAnimationFrame(tick);
      }).catch(cleanup);
    } catch {
      // Recording remains available when the browser cannot draw a level meter.
      cleanup();
    }
    return cleanup;
  }, [stream, paused]);
  return (
    <div className="flex h-8 items-center gap-1" aria-label="Microphone input level">
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index} aria-hidden className={`h-5 flex-1 rounded-sm ${stream && !paused && index < level * 0.24 ? "bg-emerald-500" : "bg-muted"}`} />
      ))}
    </div>
  );
}
