import { RichTextEditor, type RichTextEditorRef as NoteEditorRef, type JSONContent, type MentionClickDetail } from '@altitutor/ui';
import { forwardRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { JumpHighlightExtension } from '../extensions/JumpHighlightExtension';
import { useAdminRichTextImageUpload, useRefreshedAdminContent } from '@/features/rich-text-images';
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
  onMentionClick?: (detail: MentionClickDetail) => boolean;
  enableCollapsibleHeadings?: boolean;
  editable?: boolean;
  /** Default 200ms — with autosave debounce, changes persist ~0.5–0.8s after you stop typing. */
  onChangeDebounceMs?: number;
}

/**
 * Tiptap ProseMirror JSON editor component.
 * Now a wrapper around the shared RichTextEditor.
 * Supports image paste and drag-and-drop for notes_documents.
 */
export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>((props, ref) => {
  const {
    content,
    onChangeDebounceMs = 200,
    enableCollapsibleHeadings = false,
    ...rest
  } = props;
  const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
    context: 'notes_documents',
    editorRef: ref as React.RefObject<NoteEditorRef | null>,
  });
  const slashMenuSuggestions = useSlashCommandSuggestions();
  const jsonContent =
    content && typeof content === 'object'
      ? (content as unknown as Record<string, unknown>)
      : null;
  const { content: refreshedContent } = useRefreshedAdminContent(jsonContent);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <RichTextEditor
        {...rest}
        content={(refreshedContent as JSONContent | null) ?? content}
        ref={ref}
        minHeight="full"
        onChangeDebounceMs={onChangeDebounceMs}
        enableCollapsibleHeadings={enableCollapsibleHeadings}
        extensions={[JumpHighlightExtension]}
        slashMenuSuggestions={slashMenuSuggestions}
        onPasteImages={handlePasteImages}
      />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
