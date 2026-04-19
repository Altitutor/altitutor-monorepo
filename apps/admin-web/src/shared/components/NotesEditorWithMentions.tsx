'use client';

import { RichTextEditor, type RichTextEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';
import { useAdminRichTextImageUpload } from '@/features/rich-text-images';

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
 * Supports image paste and drag-and-drop.
 */
export const NotesEditorWithMentions = forwardRef<
  NotesEditorWithMentionsRef,
  NotesEditorWithMentionsProps
>(({ content, onChange, placeholder = 'Add a note...', disabled, minHeight = '80px', types, className }, ref) => {
  const mentionSuggestions = useMentionSuggestions({ types });
  const slashMenuSuggestions = useSlashCommandSuggestions();
  const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
    context: 'notes',
    editorRef: ref as React.RefObject<RichTextEditorRef | null>,
  });

  return (
    <div
      onDragOver={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onDrop={disabled ? undefined : handleDrop}
    >
      <RichTextEditor
        ref={ref}
        content={content}
        onChange={onChange}
        placeholder={placeholder}
        editable={!disabled}
        minHeight={minHeight}
        className={className}
        mentionSuggestions={mentionSuggestions}
        slashMenuSuggestions={slashMenuSuggestions}
        onPasteImages={handlePasteImages}
      />
    </div>
  );
});

NotesEditorWithMentions.displayName = 'NotesEditorWithMentions';
