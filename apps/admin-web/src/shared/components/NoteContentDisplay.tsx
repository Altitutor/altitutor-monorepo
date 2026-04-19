'use client';

import type { JSONContent } from '@tiptap/core';
import { NoteViewer } from '@/features/notes/components/NoteViewer';
import { useRefreshedAdminContent } from '@/features/rich-text-images';
import { renderTextWithTagsAsPlainText } from '@/shared/utils/tagDisplay';
import { cn } from '@/shared/utils';

interface NoteContentDisplayProps {
  /** Note content: TipTap JSON, plain text, or legacy @[type:id:text] (from DB Json type) */
  content: unknown;
  className?: string;
}

/**
 * Display note content - TipTap JSON, plain text, or legacy @[type:id:text] format.
 * Use in ActivityItem and note cards for consistent rendering.
 * Refreshes expired signed URLs for admin rich text images before display.
 */
export function NoteContentDisplay({ content, className }: NoteContentDisplayProps) {
  if (!content) {
    return null;
  }

  const str = typeof content === 'string' ? content : JSON.stringify(content);

  // Check if it looks like TipTap JSON
  const trimmed = str.trim();
  if ((trimmed.startsWith('{') && trimmed.includes('"type"') && trimmed.includes('"doc"')) || (trimmed.startsWith('{') && trimmed.includes('"content"'))) {
    try {
      const parsed = JSON.parse(str) as Record<string, unknown>;
      return (
        <NoteContentDisplayTiptap content={parsed} className={className} />
      );
    } catch {
      // Fall through to plain text
    }
  }

  // Plain text or legacy @[type:id:text]
  return (
    <div
      className={cn(
        'text-sm text-foreground whitespace-pre-wrap break-words',
        className
      )}
    >
      {renderTextWithTagsAsPlainText(str)}
    </div>
  );
}

function NoteContentDisplayTiptap({
  content,
  className,
}: {
  content: Record<string, unknown>;
  className?: string;
}) {
  const { content: refreshedContent, isLoading } =
    useRefreshedAdminContent(content);

  if (isLoading) {
    return (
      <div className={cn('text-muted-foreground animate-pulse', className)}>
        Loading...
      </div>
    );
  }

  return (
    <NoteViewer
      content={(refreshedContent ?? content) as JSONContent}
      className={className}
    />
  );
}
