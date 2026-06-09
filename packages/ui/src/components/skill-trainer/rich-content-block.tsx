"use client";

import { RichTextEditor } from "../rich-text-editor";
import { hasProseMirrorContent } from "./passage";

export type SkillTrainerRichContentProps = {
  json?: Record<string, unknown> | null;
  plainText: string;
  className?: string;
};

/** Read-only rich text for skill trainer question bodies. */
export function SkillTrainerRichContent({
  json,
  plainText,
  className,
}: SkillTrainerRichContentProps) {
  if (hasProseMirrorContent(json)) {
    return (
      <div className={className}>
        <RichTextEditor
          content={json as Record<string, unknown>}
          editable={false}
          minHeight="auto"
          className="min-h-0 text-foreground [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:text-foreground"
        />
      </div>
    );
  }

  return (
    <p className={`whitespace-pre-line text-foreground ${className ?? ""}`}>
      {plainText || "\u00A0"}
    </p>
  );
}
