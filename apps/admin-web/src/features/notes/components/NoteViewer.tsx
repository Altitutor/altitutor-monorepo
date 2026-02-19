'use client';

import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import type { JSONContent } from '@tiptap/core';
import { cn } from '@/shared/utils';

interface NoteViewerProps {
  content: JSONContent | string | null | undefined;
  className?: string;
}

/**
 * Component to render ProseMirror JSON content in view mode
 */
export function NoteViewer({ content, className }: NoteViewerProps) {
  if (!content) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No content yet. Click edit to add content.
      </div>
    );
  }

  let jsonContent: JSONContent;
  try {
    jsonContent = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    // Treat as plain text if JSON parsing fails
    jsonContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: String(content) }] }]
    };
  }

  const html = generateHTML(jsonContent, [
    StarterKit.configure({
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),
    TableKit.configure({
      table: {
        resizable: true,
      },
    }),
    TextStyleKit.configure({
      fontFamily: {
        types: ['textStyle'],
      },
      fontSize: {
        types: ['textStyle'],
      },
      color: {
        types: ['textStyle'],
      },
      backgroundColor: {
        types: ['textStyle'],
      },
    }),
    Typography,
  ]);

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
        'prose-li:my-1',
        'prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
        'prose-td:border prose-td:border-border prose-td:p-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
