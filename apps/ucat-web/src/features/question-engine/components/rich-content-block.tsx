"use client";

import { RichTextEditor } from "@altitutor/ui";
import { useRefreshedUcatContent } from "@/features/question-engine/hooks/use-refreshed-ucat-content";

function hasContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false;
  const content = json.content;
  return Array.isArray(content) && content.length > 0;
}

type RichContentBlockProps = {
  /** Rich JSON (Tiptap). When present and has content, renders via RichTextEditor. */
  json?: Record<string, unknown> | null;
  /** Fallback plain text when json is absent or empty. */
  plainText: string;
  /** Pre-refreshed content (from cache). When provided, renders immediately without loading. */
  preloadedContent?: Record<string, unknown> | null;
  className?: string;
};

/**
 * Renders rich content (images, formatting) when JSON is available.
 * Refreshes expired Supabase signed URLs so images load correctly.
 * Uses preloadedContent when available for instant display.
 */
export function RichContentBlock({
  json,
  plainText,
  preloadedContent,
  className,
}: RichContentBlockProps) {
  const { content, isLoading } = useRefreshedUcatContent(
    preloadedContent != null ? undefined : json,
  );

  const displayContent = preloadedContent ?? content;

  if (hasContent(json)) {
    if (displayContent == null || (preloadedContent == null && isLoading)) {
      return (
        <p className={`whitespace-pre-line ${className ?? ""}`}>
          {plainText || "\u00A0"}
        </p>
      );
    }
    return (
      <div className={className}>
        <RichTextEditor
          content={displayContent}
          editable={false}
          minHeight="auto"
          className="min-h-0 [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0"
        />
      </div>
    );
  }
  return (
    <p className={`whitespace-pre-line ${className ?? ""}`}>
      {plainText || "\u00A0"}
    </p>
  );
}
