"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import tippy from "tippy.js";
import { Badge, Skeleton } from "@altitutor/ui";
import type { ReferenceDetails } from "../types";

function ReferencePreview({ target }: { target: HTMLElement }) {
  const type = target.dataset.type ?? "";
  const id = target.dataset.id ?? "";
  const query = useQuery<ReferenceDetails>({
    queryKey: ["entity-reference", type, id],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/entity-references/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
        { signal },
      );
      if (!response.ok) throw new Error("Preview unavailable");
      return response.json();
    },
    staleTime: 30_000,
    retry: false,
  });
  const label =
    type === "note"
      ? "Document"
      : type === "adminShift" || type === "admin-shift"
        ? "Admin shift"
        : type === "tutorLog" || type === "tutor-log"
          ? "Tutor log"
          : type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <div
      role="dialog"
      aria-label={`${label} preview`}
      className="max-h-[70vh] overflow-y-auto w-80 max-w-[calc(100vw-24px)] rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold">
          {query.data?.title || target.dataset.label || "Preview"}
        </h3>
        {query.data?.status && (
          <Badge variant="outline" className="shrink-0">
            {query.data.status.replaceAll("_", " ")}
          </Badge>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : query.isError ? (
        <p className="text-muted-foreground">Preview unavailable</p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          {query.data.fields.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** One delegated surface covers React chips and serialized mentions, including newly loaded rich text. */
export function EntityReferenceHovers() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setContent(document.createElement("div"));
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const enter = (event: Event) => {
      const chip =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              "[data-mention][data-id][data-type]",
            )
          : null;
      if (!chip) return;
      const previous = event instanceof MouseEvent ? event.relatedTarget : null;
      if (previous instanceof Node && chip.contains(previous)) return;
      clear();
      timer.current = setTimeout(
        () => {
          if (chip.isConnected) setTarget(chip);
        },
        event.type === "focusin" ? 0 : 300,
      );
    };
    const leave = (event: MouseEvent) => {
      const chip =
        event.target instanceof Element
          ? event.target.closest("[data-mention]")
          : null;
      if (
        chip &&
        !(
          event.relatedTarget instanceof Node &&
          chip.contains(event.relatedTarget)
        )
      )
        clear();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clear();
        setTarget(null);
      }
    };
    document.addEventListener("mouseover", enter);
    document.addEventListener("focusin", enter);
    document.addEventListener("mouseout", leave);
    document.addEventListener("keydown", escape);
    return () => {
      clear();
      document.removeEventListener("mouseover", enter);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (!target || !content) return;
    const instance = tippy(target, {
      content,
      interactive: true,
      showOnCreate: true,
      placement: "bottom",
      appendTo: () => target.closest('[role="dialog"]') ?? document.body,
      delay: [0, 150],
      onHidden: () =>
        setTarget((current) => (current === target ? null : current)),
    });
    return () => instance.destroy();
  }, [target, content]);
  return target && content
    ? createPortal(<ReferencePreview target={target} />, content)
    : null;
}
