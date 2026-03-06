'use client';

import { RichTextEditor, type RichTextEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

export type NotesEditorWithMentionsRef = RichTextEditorRef;

export interface NotesEditorWithMentionsProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  types?: readonly (keyof typeof entityTypes)[];
  className?: string;
}

/**
 * Compact TipTap editor with @ mention autocomplete for polymorphic notes.
 * Use in activity tabs and note cards.
 */
export const NotesEditorWithMentions = forwardRef<
  NotesEditorWithMentionsRef,
  NotesEditorWithMentionsProps
>(({ content, onChange, placeholder = 'Add a note...', disabled, minHeight = '80px', types, className }, ref) => {
  const mentionSuggestions = useMentionSuggestions({ types });

  return (
    <RichTextEditor
      ref={ref}
      content={content}
      onChange={onChange}
      placeholder={placeholder}
      editable={!disabled}
      minHeight={minHeight}
      className={className}
      mentionSuggestions={mentionSuggestions}
    />
  );
});

NotesEditorWithMentions.displayName = 'NotesEditorWithMentions';
