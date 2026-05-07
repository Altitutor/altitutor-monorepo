import { RichTextEditor, type RichTextEditorRef as NoteEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { JumpHighlightExtension } from '../extensions/JumpHighlightExtension';
import { useAdminRichTextImageUpload } from '@/features/rich-text-images';
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';

export type { NoteEditorRef };

interface NoteEditorProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
  /** Default 200ms — with autosave debounce, changes persist ~0.5–0.8s after you stop typing. */
  onChangeDebounceMs?: number;
}

/**
 * Tiptap ProseMirror JSON editor component.
 * Now a wrapper around the shared RichTextEditor.
 * Supports image paste and drag-and-drop for notes_documents.
 */
export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>((props, ref) => {
  const { onChangeDebounceMs = 200, ...rest } = props;
  const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
    context: 'notes_documents',
    editorRef: ref as React.RefObject<NoteEditorRef | null>,
  });
  const slashMenuSuggestions = useSlashCommandSuggestions();

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <RichTextEditor
        {...rest}
        ref={ref}
        minHeight="full"
        onChangeDebounceMs={onChangeDebounceMs}
        extensions={[JumpHighlightExtension]}
        slashMenuSuggestions={slashMenuSuggestions}
        onPasteImages={handlePasteImages}
      />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
