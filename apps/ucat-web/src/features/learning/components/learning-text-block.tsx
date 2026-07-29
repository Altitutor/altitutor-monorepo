"use client";

import React, { useEffect, useRef } from "react";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { cn } from "@/lib/utils";

/** Body headings sit under the page title (`text-2xl font-semibold`). */
const LEARNING_TEXT_CONTENT_CLASSNAME = cn(
  "text-foreground",
  "[&_.ProseMirror]:leading-relaxed",
  "[&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:tracking-tight [&_.ProseMirror_h1]:leading-tight",
  "[&_.ProseMirror_h1:first-child]:mt-0",
  "[&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:tracking-tight [&_.ProseMirror_h2]:leading-tight",
  "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:tracking-tight [&_.ProseMirror_h3]:leading-snug",
  "[&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/30 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground",
  "[&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-primary/10 [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm",
  "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-primary/10 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[0.9em]",
  "[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0",
  "[&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-border",
  "[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold",
  "[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top",
);

export function LearningTextBlock({
  block,
  onViewed,
}: {
  block: LearningModuleBlockRow;
  onViewed: () => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const reportedRef = useRef(false);
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;
  const content = (block.content ?? {}) as Record<string, unknown>;
  const body = content.body as Record<string, unknown> | undefined;

  useEffect(() => {
    const end = endRef.current;
    if (!end) return;

    reportedRef.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || reportedRef.current) return;

        reportedRef.current = true;
        observer.disconnect();
        onViewedRef.current();
      },
      { rootMargin: "0px 0px -24px 0px" },
    );

    observer.observe(end);
    return () => observer.disconnect();
  }, [block.id]);

  return (
    <div className="pr-2">
      <RichContentBlock
        json={body ?? null}
        plainText=""
        textTone="theme"
        className={LEARNING_TEXT_CONTENT_CLASSNAME}
        paragraphSpacing
      />
      <div ref={endRef} aria-hidden className="h-px" />
    </div>
  );
}
