'use client';

import { forwardRef } from 'react';
import {
  RichTextEditor,
  type RichTextEditorRef,
  type JSONContent,
} from '@altitutor/ui';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useAdminRichTextImageUpload } from '../hooks/useAdminRichTextImageUpload';
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';
import type { AdminRichTextImageContext } from '../api/uploadAdminRichTextImage';

export interface AdminRichTextEditorWithImagesProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  className?: string;
  context: AdminRichTextImageContext;
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
}

/**
 * RichTextEditor with image paste and drag-and-drop support.
 * Use for inline editors in entity lists (TasksList, ProjectsList, IssuesList).
 */
export const AdminRichTextEditorWithImages = forwardRef<
  RichTextEditorRef,
  AdminRichTextEditorWithImagesProps
>(
  (
    {
      content,
      onChange,
      placeholder,
      className,
      context,
      mentionSuggestions,
    },
    ref
  ) => {
    const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
      context,
      editorRef: ref as React.RefObject<RichTextEditorRef | null>,
    });
    const slashMenuSuggestions = useSlashCommandSuggestions();

    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <RichTextEditor
          ref={ref}
          content={content}
          onChange={onChange}
          placeholder={placeholder}
          className={className}
          mentionSuggestions={mentionSuggestions}
          slashMenuSuggestions={slashMenuSuggestions}
          onPasteImages={handlePasteImages}
        />
      </div>
    );
  }
);

AdminRichTextEditorWithImages.displayName = 'AdminRichTextEditorWithImages';
