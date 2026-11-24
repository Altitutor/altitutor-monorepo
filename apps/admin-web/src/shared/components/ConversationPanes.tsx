"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePanelMediaQuery } from "@/shared/hooks/usePanelMediaQuery";

const minListWidth = 260;
const minThreadWidth = 360;
const defaultListWidth = 320;

export function ConversationPanes({ list, thread, label, threadOnly = false }: {
  list: ReactNode;
  thread?: ReactNode;
  label: string;
  threadOnly?: boolean;
}) {
  const wide = usePanelMediaQuery("(min-width: 768px)");
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; start: number; width: number } | null>(null);
  const [width, setWidth] = useState(defaultListWidth);
  const [available, setAvailable] = useState(0);
  const [resizing, setResizing] = useState(false);
  const split = Boolean(thread && wide && !threadOnly);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maximum = available
    ? Math.max(minListWidth, Math.min(available * 0.55, available - minThreadWidth))
    : defaultListWidth;
  const listWidth = Math.min(width, maximum);
  const resize = (value: number) => setWidth(Math.max(minListWidth, Math.min(maximum, value)));
  return (
    <div ref={host} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        hidden={Boolean(thread && !split)}
        className={
          thread && !split
            ? "hidden"
            : "flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden motion-safe:transition-[flex-basis] motion-safe:duration-150 data-[resizing]:transition-none"
        }
        style={{ flexBasis: split ? listWidth : "100%" }}
        data-resizing={resizing || undefined}
      >
        {list}
      </div>
      {split && (
        <div
          role="separator"
          aria-label="Resize conversation panes"
          aria-orientation="vertical"
          aria-valuemin={minListWidth}
          aria-valuemax={Math.round(maximum)}
          aria-valuenow={Math.round(listWidth)}
          tabIndex={0}
          className="relative z-10 w-px shrink-0 cursor-col-resize touch-none bg-border after:absolute after:inset-y-0 after:-left-1.5 after:w-3 hover:bg-primary focus-visible:bg-primary focus-visible:outline-none"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizing(true);
            drag.current = { pointer: event.pointerId, start: event.clientX, width: listWidth };
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (active?.pointer === event.pointerId) resize(active.width + event.clientX - active.start);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            setResizing(false);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 48 : 16;
            const sizes: Partial<Record<string, number>> = { ArrowLeft: listWidth - step, ArrowRight: listWidth + step, Home: minListWidth, End: maximum };
            const next = sizes[event.key];
            if (next === undefined) return;
            event.preventDefault();
            resize(next);
          }}
        />
      )}
      {thread && (
        <section
          aria-label={label}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-150"
        >
          {thread}
        </section>
      )}
    </div>
  );
}
