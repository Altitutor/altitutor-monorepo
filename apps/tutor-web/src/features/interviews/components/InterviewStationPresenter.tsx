"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { interviewText, type InterviewStation } from "@altitutor/shared";
import { ExternalLink, Eye, EyeOff, Monitor } from "lucide-react";
import { InterviewDocument, InterviewPanel } from "./interview-ui";

function presentationPrompt(value: InterviewStation["prompt"]): JSONContent {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.type === "doc"
  )
    return value as JSONContent;
  const text = interviewText(value);
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
    ],
  };
}

export function InterviewStationPresenter({
  station,
  close,
}: {
  station: InterviewStation;
  close: () => void;
}) {
  const [session] = useState(randomUuid);
  const [blanked, setBlanked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const windowRef = useRef<Window | null>(null);

  const sendPrompt = useCallback(() => {
    // The audience channel never receives questions, rubrics, or catalog data.
    channelRef.current?.postMessage({
      type: "prompt",
      prompt: presentationPrompt(station.prompt),
      blanked,
    });
  }, [station.prompt, blanked]);
  const sendPromptRef = useRef(sendPrompt);

  useEffect(() => {
    sendPromptRef.current = sendPrompt;
    sendPrompt();
  }, [sendPrompt]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`interview-prompt:${session}`);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        "type" in event.data &&
        event.data.type === "ready"
      ) {
        setConnected(true);
        sendPromptRef.current();
      }
    };
    const stopDisplay = () => channel.postMessage({ type: "stop" });
    window.addEventListener("pagehide", stopDisplay);
    return () => {
      window.removeEventListener("pagehide", stopDisplay);
      stopDisplay();
      channel.close();
      channelRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (windowRef.current?.closed) setConnected(false);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function openDisplay() {
    if (typeof BroadcastChannel === "undefined") {
      setError("This browser does not support a separate presentation window.");
      return;
    }
    const display = window.open(
      `/interview-display#${session}`,
      `interview-display-${session}`,
      "popup,width=1280,height=800",
    );
    if (!display) {
      setError(
        "Allow pop-ups for this site, then open the presentation again.",
      );
      return;
    }
    display.opener = null;
    windowRef.current = display;
    setError(null);
    display.focus();
  }

  function stopPresentation() {
    channelRef.current?.postMessage({ type: "stop" });
    windowRef.current?.close();
    close();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) stopPresentation();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Present {station.name}</DialogTitle>
          <DialogDescription>
            Move the presentation window to your monitor or TV. Only the prompt
            appears there; questions and rubrics stay here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={openDisplay}>
            <ExternalLink className="mr-2 size-4" />
            {connected
              ? "Focus presentation window"
              : "Open presentation window"}
          </Button>
          <Button
            variant="outline"
            disabled={!connected}
            onClick={() => setBlanked(!blanked)}
          >
            {blanked ? (
              <Eye className="mr-2 size-4" />
            ) : (
              <EyeOff className="mr-2 size-4" />
            )}
            {blanked ? "Show prompt" : "Blank display"}
          </Button>
          <span
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Monitor className="size-4" />
            {connected
              ? blanked
                ? "Display blanked"
                : "Prompt on display"
              : "Display not connected"}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <InterviewPanel title="Audience prompt">
            <InterviewDocument value={station.prompt as JSONContent} />
          </InterviewPanel>
          <InterviewPanel
            title="Questions and rubrics · tutor only"
            className="space-y-6"
          >
            {station.questions.map((question, index) => (
              <section key={question.id} className="space-y-3">
                <h3 className="text-sm font-semibold">Question {index + 1}</h3>
                <InterviewDocument value={question.question as JSONContent} />
                <div className="border-l-2 border-border pl-4">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Rubric
                  </p>
                  <InterviewDocument value={question.rubric as JSONContent} />
                </div>
              </section>
            ))}
          </InterviewPanel>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={stopPresentation}>
            End presentation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
