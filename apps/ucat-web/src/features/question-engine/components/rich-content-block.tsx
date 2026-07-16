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
  /** Sampler-only coaching emphasis for an exact plain-text phrase. */
  highlightText?: string;
};

function renderHighlightedText(text: string, highlightText?: string) {
  if (!highlightText) return text;
  const index = text.toLocaleLowerCase().indexOf(highlightText.toLocaleLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark
        data-sampler-passage-highlight
        className="rounded-sm bg-[#fff59d] px-0.5 text-inherit shadow-[0_0_0_2px_rgba(255,245,157,0.35)] transition-colors"
      >
        {text.slice(index, index + highlightText.length)}
      </mark>
      {text.slice(index + highlightText.length)}
    </>
  );
}

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
  highlightText,
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
      return (
        <p className={cn("whitespace-pre-line", className)}>
          {renderHighlightedText(text, highlightText)}
        </p>
      );
    }

    const paragraphs = text.split(/\r?\n/u);
    return (
      <div className={cn("space-y-2", className)}>
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 12)}`}>
            {renderHighlightedText(paragraph || "\u00A0", highlightText)}
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
