"use client";

import dynamic from "next/dynamic";
import type { JSONContent } from "@altitutor/ui";
import type { InterviewRichText } from "@altitutor/shared";
import { cn } from "@/shared/utils";

const RichTextEditor = dynamic(
  () => import("@altitutor/ui").then((module) => module.RichTextEditor),
  { ssr: false },
);

export function InterviewContent({
  value,
  className,
}: {
  value: InterviewRichText;
  className?: string;
}) {
  const content =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && !Array.isArray(value)
        ? (value as JSONContent)
        : null;
  return (
    <RichTextEditor
      content={content}
      editable={false}
      autoHeight
      minHeight="0"
      className={cn("border-0 bg-transparent p-0", className)}
    />
  );
}
