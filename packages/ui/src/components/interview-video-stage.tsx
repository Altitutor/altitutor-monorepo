"use client";

import React, { useId, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { cn } from "../lib/cn";

export type InterviewVideoView = "pip" | "side-by-side";
type PreviewCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const cornerClasses: Record<PreviewCorner, string> = {
  "top-left": "left-3 top-3",
  "top-right": "right-3 top-3",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

/** Presentation only: moving or rearranging video never owns the call lifecycle. */
export function InterviewVideoStage({
  localVideo,
  remoteVideo,
  view,
  children,
}: {
  localVideo?: React.ReactNode;
  remoteVideo?: React.ReactNode;
  view: InterviewVideoView;
  children?: React.ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [corner, setCorner] = useState<PreviewCorner>("bottom-right");
  const instructions = useId();
  const drag = useRef<{
    pointerId: number;
    bounds: DOMRect;
    grabX: number;
    grabY: number;
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const paired = !!localVideo && !!remoteVideo;
  const sideBySide = paired && view === "side-by-side";

  const finishDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const moving = drag.current;
    if (!moving || moving.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!cancelled) {
      const vertical =
        moving.y + moving.height / 2 < moving.bounds.height / 2
          ? "top"
          : "bottom";
      const horizontal =
        moving.x + moving.width / 2 < moving.bounds.width / 2
          ? "left"
          : "right";
      setCorner(`${vertical}-${horizontal}`);
    }
    const element = event.currentTarget;
    element.style.left = "";
    element.style.top = "";
    element.style.right = "";
    element.style.bottom = "";
    element.style.cursor = "";
    if (element.hasPointerCapture(event.pointerId))
      element.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={stage}
      role="group"
      aria-label="Interview video"
      className={cn(
        "relative w-full overflow-hidden bg-slate-950",
        sideBySide ? "grid grid-cols-2 gap-2" : "aspect-video",
      )}
    >
      <div className={sideBySide ? "aspect-video min-w-0" : "h-full"}>
        {remoteVideo || localVideo || (
          <div className="flex h-full items-center justify-center text-slate-400">
            <CameraOff className="h-8 w-8" aria-hidden />
          </div>
        )}
      </div>
      {sideBySide ? (
        <div className="aspect-video min-w-0">{localVideo}</div>
      ) : paired ? (
        <button
          type="button"
          aria-label={`Move your video preview (${corner.replaceAll("-", " ")})`}
          aria-describedby={instructions}
          className={cn(
            "absolute z-10 aspect-video w-[28%] min-w-[4.5rem] max-w-56 touch-none cursor-grab overflow-hidden rounded-lg border border-white/30 bg-slate-950 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            cornerClasses[corner],
          )}
          onPointerDown={(event) => {
            if (event.button !== 0 || !stage.current) return;
            const bounds = stage.current.getBoundingClientRect();
            const preview = event.currentTarget.getBoundingClientRect();
            drag.current = {
              pointerId: event.pointerId,
              bounds,
              grabX: event.clientX - preview.left,
              grabY: event.clientY - preview.top,
              width: preview.width,
              height: preview.height,
              x: preview.left - bounds.left,
              y: preview.top - bounds.top,
            };
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const moving = drag.current;
            if (!moving || moving.pointerId !== event.pointerId) return;
            moving.x = Math.max(
              0,
              Math.min(
                moving.bounds.width - moving.width,
                event.clientX - moving.bounds.left - moving.grabX,
              ),
            );
            moving.y = Math.max(
              0,
              Math.min(
                moving.bounds.height - moving.height,
                event.clientY - moving.bounds.top - moving.grabY,
              ),
            );
            // Pointer movement stays local to this element, avoiding call renders.
            const element = event.currentTarget;
            element.style.left = `${moving.x}px`;
            element.style.top = `${moving.y}px`;
            element.style.right = "auto";
            element.style.bottom = "auto";
            element.style.cursor = "grabbing";
          }}
          onPointerUp={(event) => finishDrag(event)}
          onPointerCancel={(event) => finishDrag(event, true)}
          onLostPointerCapture={(event) => finishDrag(event, true)}
          onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow")) return;
            event.preventDefault();
            setCorner((previous) => {
              const vertical =
                event.key === "ArrowUp"
                  ? "top"
                  : event.key === "ArrowDown"
                    ? "bottom"
                    : previous.startsWith("top")
                      ? "top"
                      : "bottom";
              const horizontal =
                event.key === "ArrowLeft"
                  ? "left"
                  : event.key === "ArrowRight"
                    ? "right"
                    : previous.endsWith("left")
                      ? "left"
                      : "right";
              return `${vertical}-${horizontal}`;
            });
          }}
        >
          <span className="pointer-events-none block h-full">{localVideo}</span>
        </button>
      ) : null}
      <span id={instructions} className="sr-only">
        Drag your preview to a corner, or use the arrow keys to move it.
      </span>
      {children}
    </div>
  );
}
