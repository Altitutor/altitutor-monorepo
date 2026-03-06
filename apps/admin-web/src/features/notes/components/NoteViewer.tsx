'use client';

import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import type { JSONContent } from '@tiptap/core';
import { cn } from '@/shared/utils';
import { renderTextWithTagsAsPlainText } from '@/shared/utils/tagDisplay';

interface NoteViewerProps {
  content: JSONContent | string | null | undefined;
  className?: string;
}

/** Extensions for generateHTML - must include Mention to render mention nodes */
const VIEW_EXTENSIONS = [
  StarterKit.configure({
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  Mention.configure({
    HTMLAttributes: {
      class: 'bg-primary/10 text-primary px-1 rounded-sm font-medium',
      'data-mention': 'true',
    },
  }).extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (attrs) => ({ 'data-id': attrs.id }) },
        label: { default: null, parseHTML: (el) => el.getAttribute('data-label') || el.innerText, renderHTML: (attrs) => ({ 'data-label': attrs.label }) },
        type: { default: null, parseHTML: (el) => el.getAttribute('data-type'), renderHTML: (attrs) => ({ 'data-type': attrs.type }) },
      };
    },
  }),
  TableKit.configure({ table: { resizable: true } }),
  TextStyleKit.configure({
    fontFamily: { types: ['textStyle'] },
    fontSize: { types: ['textStyle'] },
    color: { types: ['textStyle'] },
    backgroundColor: { types: ['textStyle'] },
  }),
  Typography,
];

/**
 * Component to render ProseMirror JSON content in view mode.
 * Handles TipTap JSON, plain text, and legacy @[type:id:text] format.
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
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      jsonContent = parsed;
    } else {
      jsonContent = content;
    }
  } catch {
    // Plain text or legacy @[type:id:text] - render as plain text (replace tags with display text)
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none prose-p:my-2 whitespace-pre-wrap break-words',
          className
        )}
      >
        {renderTextWithTagsAsPlainText(String(content))}
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
          'prose-h1:mt-7 prose-h1:mb-1.5 prose-h2:mt-6 prose-h2:mb-1 prose-h3:mt-5 prose-h3:mb-1',
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-1',
          'prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
          'prose-td:border prose-td:border-border prose-td:p-2',
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none prose-p:my-2 whitespace-pre-wrap break-words',
          className
        )}
      >
        {renderTextWithTagsAsPlainText(JSON.stringify(jsonContent))}
      </div>
    );
  }
}
