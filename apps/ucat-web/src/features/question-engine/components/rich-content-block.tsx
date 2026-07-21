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

/**
 * Pin readable body text on white UCAT exam chrome while the app theme is dark.
 * TipTap defaults to `text-foreground`, which becomes white in dark mode.
 */
const UCAT_ENGINE_TEXT_CLASSNAME = cn(
  "text-black [color-scheme:light] dark:text-black",
  "[&_.tiptap]:!text-black [&_.tiptap]:dark:!text-black",
  "[&_.ProseMirror]:!text-black [&_.ProseMirror]:dark:!text-black",
  "[&_p]:!text-black [&_li]:!text-black [&_li]:marker:!text-neutral-600",
  "[&_h1]:!text-black [&_h2]:!text-black [&_h3]:!text-black",
);

/**
 * Follow app foreground on themed surfaces (attempt review, learning).
 * Also clears authoring-time inline colors/backgrounds that would fight dark mode.
 */
const UCAT_THEME_TEXT_CLASSNAME = cn(
  "text-foreground",
  "[&_.tiptap]:text-foreground [&_.ProseMirror]:text-foreground",
  "[&_p]:text-foreground [&_li]:text-foreground [&_li]:marker:text-foreground",
  "[&_strong]:text-foreground [&_em]:text-foreground [&_u]:text-foreground",
  "[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground",
  "[&_.ProseMirror_span[style*='color']]:!text-foreground",
  "[&_.ProseMirror_span[style*='background']]:!bg-transparent",
);

/**
 * Table borders on TipTap root (className merges onto view.dom / `.tiptap.ProseMirror`).
 * Matches tutor-web `UCAT_ENGINE_TABLE_ROOT_CLASSNAME` — `#9ba9bd` stays visible on white exam chrome.
 */
const UCAT_ENGINE_TABLE_ROOT_CLASSNAME =
  "[&_table]:my-2 [&_table]:w-max [&_table]:min-w-full [&_table]:border-collapse [&_table]:border [&_table]:border-solid [&_table]:!border-[#9ba9bd] [&_th]:min-w-24 [&_th]:border [&_th]:border-solid [&_th]:!border-[#9ba9bd] [&_th]:bg-[#f3f4f6] [&_th]:p-2 [&_th]:text-left [&_td]:min-w-24 [&_td]:border [&_td]:border-solid [&_td]:!border-[#9ba9bd] [&_td]:p-2 [&_td]:align-top";

/**
 * Table borders when styles live on a wrapper around RichTextEditor.
 * Matches tutor-web `UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME`.
 */
const UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME =
  "max-w-full overflow-x-auto overscroll-x-contain [&_.tiptap_table]:my-2 [&_.tiptap_table]:w-max [&_.tiptap_table]:min-w-full [&_.tiptap_table]:border-collapse [&_.tiptap_table]:border [&_.tiptap_table]:border-solid [&_.tiptap_table]:!border-[#9ba9bd] [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-max [&_.ProseMirror_table]:min-w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-solid [&_.ProseMirror_table]:!border-[#9ba9bd] [&_.tiptap_th]:min-w-24 [&_.tiptap_th]:border [&_.tiptap_th]:border-solid [&_.tiptap_th]:!border-[#9ba9bd] [&_.tiptap_th]:bg-[#f3f4f6] [&_.tiptap_th]:p-2 [&_.tiptap_th]:text-left [&_.ProseMirror_th]:min-w-24 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-solid [&_.ProseMirror_th]:!border-[#9ba9bd] [&_.ProseMirror_th]:bg-[#f3f4f6] [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.tiptap_td]:min-w-24 [&_.tiptap_td]:border [&_.tiptap_td]:border-solid [&_.tiptap_td]:!border-[#9ba9bd] [&_.tiptap_td]:p-2 [&_.tiptap_td]:align-top [&_.ProseMirror_td]:min-w-24 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-solid [&_.ProseMirror_td]:!border-[#9ba9bd] [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top";

/**
 * Theme-aware tables for dark/light app chrome (skill trainers, learning, review).
 * Avoids engine `#f3f4f6` headers which become unreadable with white dark-mode text.
 */
const UCAT_THEME_TABLE_ROOT_CLASSNAME =
  "[&_table]:my-2 [&_table]:w-max [&_table]:min-w-full [&_table]:border-collapse [&_table]:border [&_table]:border-solid [&_table]:border-border [&_th]:min-w-24 [&_th]:border [&_th]:border-solid [&_th]:border-border [&_th]:!bg-muted [&_th]:p-2 [&_th]:text-left [&_th]:text-foreground [&_td]:min-w-24 [&_td]:border [&_td]:border-solid [&_td]:border-border [&_td]:p-2 [&_td]:align-top [&_td]:text-foreground";

const UCAT_THEME_TABLE_WRAPPER_CLASSNAME =
  "max-w-full overflow-x-auto overscroll-x-contain [&_.tiptap_table]:my-2 [&_.tiptap_table]:w-max [&_.tiptap_table]:min-w-full [&_.tiptap_table]:border-collapse [&_.tiptap_table]:border [&_.tiptap_table]:border-solid [&_.tiptap_table]:border-border [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-max [&_.ProseMirror_table]:min-w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-solid [&_.ProseMirror_table]:border-border [&_.tiptap_th]:min-w-24 [&_.tiptap_th]:border [&_.tiptap_th]:border-solid [&_.tiptap_th]:border-border [&_.tiptap_th]:!bg-muted [&_.tiptap_th]:p-2 [&_.tiptap_th]:text-left [&_.tiptap_th]:text-foreground [&_.ProseMirror_th]:min-w-24 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-solid [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:!bg-muted [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:text-foreground [&_.tiptap_td]:min-w-24 [&_.tiptap_td]:border [&_.tiptap_td]:border-solid [&_.tiptap_td]:border-border [&_.tiptap_td]:p-2 [&_.tiptap_td]:align-top [&_.tiptap_td]:text-foreground [&_.ProseMirror_td]:min-w-24 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-solid [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top [&_.ProseMirror_td]:text-foreground";

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
  /**
   * `engine` pins black text on white UCAT chrome (default).
   * `theme` follows app foreground (learning lessons, site-themed review).
   */
  textTone?: "engine" | "theme";
  paragraphSpacing?: boolean;
  /** Sampler-only coaching emphasis for an exact plain-text phrase. */
  highlightText?: string;
};

function renderHighlightedText(text: string, highlightText?: string) {
  if (!highlightText) return text;
  const index = text
    .toLocaleLowerCase()
    .indexOf(highlightText.toLocaleLowerCase());
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
  textTone = "engine",
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

  const isThemeTone = textTone === "theme";
  const toneClass = isThemeTone
    ? UCAT_THEME_TEXT_CLASSNAME
    : UCAT_ENGINE_TEXT_CLASSNAME;
  const tableWrapperClassName = isThemeTone
    ? UCAT_THEME_TABLE_WRAPPER_CLASSNAME
    : UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME;
  const tableRootClassName = isThemeTone
    ? UCAT_THEME_TABLE_ROOT_CLASSNAME
    : UCAT_ENGINE_TABLE_ROOT_CLASSNAME;

  const renderPlainText = () => {
    const text = plainText || "\u00A0";
    if (!paragraphSpacing) {
      return (
        <p className={cn("whitespace-pre-line", toneClass, className)}>
          {renderHighlightedText(text, highlightText)}
        </p>
      );
    }

    const paragraphs = text.split(/\r?\n/u);
    return (
      <div className={cn("space-y-2", toneClass, className)}>
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
      <div className={cn(tableWrapperClassName, toneClass, className)}>
        <RichTextEditor
          key={editorKey}
          content={displayContent}
          editable={false}
          omitTypography
          minHeight="auto"
          className={cn(
            "min-h-0 text-inherit [&]:min-h-0 [&]:p-0 [&]:pl-0",
            tableRootClassName,
            "[&_strong]:font-bold [&_b]:font-bold [&_em]:italic",
            paragraphSpacing && PARAGRAPH_SPACING_CLASS,
          )}
        />
      </div>
    );
  }
  return renderPlainText();
}
