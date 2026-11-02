'use client';

import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EntityMention } from '@altitutor/ui';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details';
import { CollapsibleHeading } from '@altitutor/ui';
import type { JSONContent } from '@tiptap/core';
import type { MentionClickDetail } from '@altitutor/ui';
import { useRefreshedAdminContent } from '@/features/rich-text-images';
import { cn } from '@/shared/utils';
import { renderTextWithTagsAsPlainText } from '@/shared/utils/tagDisplay';

interface NoteViewerProps {
  content: JSONContent | string | null | undefined;
  className?: string;
  /** When provided and returns true, blocks the global `mentionClick` window event. */
  onMentionClick?: (detail: MentionClickDetail) => boolean;
}

/** Extensions for generateHTML - must include Mention and Image to render mention and image nodes */
const VIEW_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  CollapsibleHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  EntityMention,
  TableKit.configure({ table: { resizable: true } }),
  Image.configure({
    HTMLAttributes: {
      class: 'my-3 rounded-md max-w-full h-auto',
    },
  }),
  TextStyleKit.configure({
    fontFamily: { types: ['textStyle'] },
    fontSize: { types: ['textStyle'] },
    color: { types: ['textStyle'] },
    backgroundColor: { types: ['textStyle'] },
  }),
  Typography,
  Details.configure({
    persist: true,
    HTMLAttributes: {
      class: 'my-3 rounded-lg border border-border bg-card/40',
    },
  }),
  DetailsSummary,
  DetailsContent,
];

/**
 * Component to render ProseMirror JSON content in view mode.
 * Handles TipTap JSON, plain text, and legacy @[type:id:text] format.
 */
function JsonNoteViewer({
  jsonContent,
  className,
  onMentionClick,
}: {
  jsonContent: JSONContent;
  className?: string;
  onMentionClick?: (detail: MentionClickDetail) => boolean;
}) {
  const { content, isLoading, hasImageRefs } = useRefreshedAdminContent(
    jsonContent as Record<string, unknown>,
  );
  if (isLoading && hasImageRefs) {
    return <div className={className} aria-label="Loading note images" />;
  }

  const renderableContent = (content ?? jsonContent) as JSONContent;
  try {
    const html = generateHTML(renderableContent, VIEW_EXTENSIONS);

    const handleMentionPointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const mentionEl = (e.target as HTMLElement).closest('[data-mention]');
      if (!mentionEl) return;
      const id = mentionEl.getAttribute('data-id');
      const type = mentionEl.getAttribute('data-type');
      const label = mentionEl.textContent?.trim() ?? '';
      if (!id || !type) return;
      e.preventDefault();
      const detail: MentionClickDetail = { id, type, label };
      const handled = onMentionClick?.(detail) ?? false;
      if (!handled) {
        mentionEl.dispatchEvent(
          new CustomEvent<MentionClickDetail>('mentionClick', { detail, bubbles: true }),
        );
      }
    };

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
          className,
        )}
        dangerouslySetInnerHTML={{ __html: html }}
        onPointerDownCapture={handleMentionPointerDown}
        onKeyDownCapture={event => {
          const mention = event.target instanceof Element ? event.target.closest('[data-mention]') : null;
          if (!mention || (event.key !== 'Enter' && event.key !== ' ')) return;
          const id = mention.getAttribute('data-id');
          const type = mention.getAttribute('data-type');
          if (!id || !type) return;
          event.preventDefault();
          const detail = {id, type, label: mention.getAttribute('data-label') ?? mention.textContent ?? ''};
          if (!onMentionClick?.(detail)) mention.dispatchEvent(new CustomEvent<MentionClickDetail>('mentionClick', {detail, bubbles: true}));
        }}
      />
    );
  } catch {
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none prose-p:my-2 whitespace-pre-wrap break-words',
          className,
        )}
      >
        {renderTextWithTagsAsPlainText(JSON.stringify(renderableContent))}
      </div>
    );
  }
}

export function NoteViewer({
  content,
  className,
  onMentionClick,
}: NoteViewerProps) {
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
    // Plain text or legacy @[type:id:text] - render as plain text (replace tags with display text)
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none prose-p:my-2 whitespace-pre-wrap break-words',
          className,
        )}
      >
        {renderTextWithTagsAsPlainText(String(content))}
      </div>
    );
  }

  return (
    <JsonNoteViewer
      jsonContent={jsonContent}
      className={className}
      onMentionClick={onMentionClick}
    />
  );
}
