"use client";

import dynamic from "next/dynamic";
import type { JSONContent } from "@altitutor/ui";
import type { InterviewRichText } from "@altitutor/shared";

const RichTextEditor = dynamic(
  () => import("@altitutor/ui").then((module) => module.RichTextEditor),
  { ssr: false },
);

export function InterviewContent({ value }: { value: InterviewRichText }) {
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
      className="border-0 bg-transparent p-0"
    />
  );
}
