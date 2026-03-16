'use client';

import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import type { JSONContent } from '@tiptap/core';
import { cn } from '../lib/cn';

const VIEW_EXTENSIONS = [
  StarterKit.configure({
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  Typography,
];

interface PolicyViewerProps {
  content: JSONContent | null | undefined | unknown;
  className?: string;
}

function parseContent(raw: unknown): JSONContent | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && 'type' in raw) {
    return raw as JSONContent;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return parsed as JSONContent;
      }
    } catch {
      // Fall through
    }
  }
  return null;
}

/**
 * Read-only viewer for policy content stored as Tiptap/ProseMirror JSON.
 * Renders as rich text (headings, lists, paragraphs, typography).
 */
export function PolicyViewer({ content, className }: PolicyViewerProps) {
  const jsonContent = parseContent(content);

  if (!jsonContent) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No policy content available.
      </div>
    );
  }

  try {
    const html = generateHTML(jsonContent, VIEW_EXTENSIONS);
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1',
          'prose-ul:list-disc prose-ol:list-decimal',
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return (
      <div className={cn('text-muted-foreground', className)}>
        Unable to display policy content.
      </div>
    );
  }
}
