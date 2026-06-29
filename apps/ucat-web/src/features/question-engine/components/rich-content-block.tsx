"use client";

import { useMemo } from "react";
import { RichTextEditor } from "@altitutor/ui";
import { useRefreshedUcatContent } from "@/features/question-engine/hooks/use-refreshed-ucat-content";
import {
  collectUcatImageRefsFromDoc,
  docStructureFingerprint,
} from "@/features/question-engine/lib/refresh-ucat-image-urls";
import { cn } from "@/lib/utils";

const PARAGRAPH_SPACING_CLASS =
  "[&_p]:!my-2 [&_p:first-child]:!mt-0 [&_p:last-child]:!mb-0";

function normalizeDoc(json: Record<string, unknown>): Record<string, unknown> {
  if (json.type === "doc" && Array.isArray(json.content)) {
    return json;
  }
  return {
    type: "doc",
    content: Array.isArray(json.content) ? json.content : [json],
  };
}

type RichContentBlockProps = {
  /** Rich JSON (Tiptap). When present and has content, renders via RichTextEditor. */
  json?: Record<string, unknown> | null;
  /** Fallback plain text when json is absent or empty. */
  plainText: string;
  /** Pre-refreshed content (from batch cache). Preferred when available. */
  preloadedContent?: Record<string, unknown> | null;
  className?: string;
  paragraphSpacing?: boolean;
};

/**
 * Renders rich content (images, formatting) when JSON is available.
 * Refreshes expired Supabase signed URLs so images load correctly.
 */
export function RichContentBlock({
  json,
  plainText,
  preloadedContent,
  className,
  paragraphSpacing = false,
}: RichContentBlockProps) {
  const normalizedDoc = useMemo(() => {
    if (!json || typeof json !== "object") return null;
    return normalizeDoc(json as Record<string, unknown>);
  }, [json]);

  const editorKey = useMemo(
    () => (normalizedDoc ? docStructureFingerprint(normalizedDoc) : plainText),
    [normalizedDoc, plainText],
  );

  const hasImageRefs = useMemo(() => {
    if (!normalizedDoc) return false;
    const refs = collectUcatImageRefsFromDoc(normalizedDoc);
    return refs.paths.length > 0 || refs.fileIds.length > 0;
  }, [normalizedDoc]);

  const { content, isLoading } = useRefreshedUcatContent(
    preloadedContent != null ? undefined : json,
  );

  const displayContent = preloadedContent ?? content;
  const waitingForImageRefresh =
    hasImageRefs &&
    displayContent == null &&
    preloadedContent == null &&
    isLoading;

  const renderPlainText = () => {
    const text = plainText || "\u00A0";
    if (!paragraphSpacing) {
      return <p className={cn("whitespace-pre-line", className)}>{text}</p>;
    }

    const paragraphs = text.split(/\r?\n/u);
    return (
      <div className={cn("space-y-2", className)}>
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 12)}`}>
            {paragraph || "\u00A0"}
          </p>
        ))}
      </div>
    );
  };

  if (normalizedDoc) {
    if (waitingForImageRefresh) {
      return renderPlainText();
    }
    if (displayContent == null) {
      return renderPlainText();
    }
    return (
      <div className={className}>
        <RichTextEditor
          key={editorKey}
          content={displayContent}
          editable={false}
          minHeight="auto"
          className={cn(
            "min-h-0 [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0",
            paragraphSpacing && PARAGRAPH_SPACING_CLASS,
          )}
        />
      </div>
    );
  }
  return renderPlainText();
}
