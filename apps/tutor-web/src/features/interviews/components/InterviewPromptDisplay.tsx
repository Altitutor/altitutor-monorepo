"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, RichTextEditor, type JSONContent } from "@altitutor/ui";
import { isUuidV4 } from "@altitutor/ui/lib/random-uuid";
import { Expand } from "lucide-react";

const displayTheme = {
  "--foreground": "212 86% 14%",
  "--muted": "220 14% 96%",
  "--muted-foreground": "212 86% 25%",
  "--border": "198 15% 85%",
  "--card": "0 0% 100%",
} as CSSProperties;

export function InterviewPromptDisplay() {
  const [prompt, setPrompt] = useState<JSONContent | null>(null);
  const [blanked, setBlanked] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const session = window.location.hash.slice(1);
    if (
      !isUuidV4(session) ||
      typeof BroadcastChannel === "undefined"
    ) {
      setError("Open this display from a station’s Cast action.");
      return;
    }
    const channel = new BroadcastChannel(`interview-prompt:${session}`);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!message || typeof message !== "object" || !("type" in message))
        return;
      if (message.type === "stop") {
        setPrompt(null);
        setEnded(true);
      } else if (
        message.type === "prompt" &&
        "prompt" in message &&
        message.prompt &&
        typeof message.prompt === "object" &&
        !Array.isArray(message.prompt) &&
        "type" in message.prompt &&
        message.prompt.type === "doc" &&
        "blanked" in message &&
        typeof message.blanked === "boolean"
      ) {
        setPrompt(message.prompt as JSONContent);
        setBlanked(message.blanked);
        setEnded(false);
      }
    };
    channel.postMessage({ type: "ready" });
    const onFullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      channel.close();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function enterFullscreen() {
    if (!surface.current?.requestFullscreen) {
      setError("Use your browser’s fullscreen option for this display.");
      return;
    }
    try {
      await surface.current.requestFullscreen();
      setError(null);
    } catch {
      setError(
        "Fullscreen was unavailable. Use your browser’s fullscreen option.",
      );
    }
  }

  return (
    <div
      ref={surface}
      style={displayTheme}
      className={`fixed inset-0 z-[200] min-h-dvh overflow-y-auto ${blanked ? "bg-black" : "bg-white text-slate-950"}`}
    >
      {!blanked && (
        <>
          {!fullscreen && (
            <div className="flex items-center justify-end gap-4 p-4">
              {error && (
                <p className="text-sm" role="alert">
                  {error}
                </p>
              )}
              <Button variant="outline" onClick={() => void enterFullscreen()}>
                <Expand className="mr-2 size-4" />
                Fullscreen
              </Button>
            </div>
          )}
          <main className="mx-auto flex min-h-[80dvh] max-w-6xl items-center px-10 py-12 md:px-20">
            {prompt ? (
              <div className="w-full text-2xl leading-relaxed [font-size:clamp(1.5rem,3vw,3rem)] [&_.ProseMirror]:[font-size:inherit] [&_.ProseMirror]:text-inherit [&_.ProseMirror]:leading-relaxed">
                <RichTextEditor
                  content={prompt}
                  editable={false}
                  omitTypography
                  autoHeight
                  minHeight="0"
                  floatingToolbar={false}
                />
              </div>
            ) : (
              <p className="w-full text-center text-xl text-slate-500">
                {error ??
                  (ended ? "Presentation ended" : "Waiting for the prompt…")}
              </p>
            )}
          </main>
        </>
      )}
    </div>
  );
}
