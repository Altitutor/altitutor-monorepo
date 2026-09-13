'use client';

import { type RichTextEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import { AdminRichTextEditorWithImages } from '@/features/rich-text-images';

export type NotesEditorWithMentionsRef = RichTextEditorRef;

export interface NotesEditorWithMentionsProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  types?: readonly (keyof typeof entityTypes)[];
  className?: string;
  /** Default 200ms — fewer RHF updates while typing long notes in activity tabs. */
  onChangeDebounceMs?: number;
  floatingToolbar?: boolean;
}

/**
 * Compact TipTap editor with @ mention autocomplete for polymorphic notes.
 * Use in activity tabs and note cards.
 * Supports image paste and drag-and-drop.
 */
export const NotesEditorWithMentions = forwardRef<
  NotesEditorWithMentionsRef,
  NotesEditorWithMentionsProps
>(
  (
    {
      content,
      onChange,
      placeholder = 'Add a note...',
      disabled,
      minHeight = '80px',
      types,
      className,
      onChangeDebounceMs = 200,
      floatingToolbar = false,
    },
    ref,
  ) => {
    const mentionSuggestions = useMentionSuggestions({ types });
    return (
      <AdminRichTextEditorWithImages
        ref={ref}
        content={content}
        onChange={onChange}
        onChangeDebounceMs={onChangeDebounceMs}
        placeholder={placeholder}
        editable={!disabled}
        minHeight={minHeight}
        className={className}
        context="notes"
        mentionSuggestions={mentionSuggestions}
        includeCollapsibleSlashCommand={false}
        floatingToolbar={floatingToolbar}
      />
    );
  },
);

NotesEditorWithMentions.displayName = 'NotesEditorWithMentions';
