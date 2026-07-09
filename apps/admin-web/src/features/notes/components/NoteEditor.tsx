import { RichTextEditor, type RichTextEditorRef as NoteEditorRef, type JSONContent, type MentionClickDetail } from '@altitutor/ui';
import { forwardRef, useCallback, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { JumpHighlightExtension } from '../extensions/JumpHighlightExtension';
import { useAdminRichTextImageUpload, useRefreshedAdminContent } from '@/features/rich-text-images';
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';
import { cn } from '@/shared/utils';

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
  minHeight?: string;
  autoHeight?: boolean;
  /** Stretch the editor to fill a flex parent (e.g. dashboard daily note card). */
  fillContainer?: boolean;
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
    onChange,
    onChangeDebounceMs = 200,
    enableCollapsibleHeadings = false,
    minHeight = 'full',
    autoHeight = false,
    fillContainer = false,
    className,
    editable = true,
    ...rest
  } = props;
  const initialContentRef = useRef(content);
  const hasLocalEditRef = useRef(false);
  const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
    context: 'notes_documents',
    editorRef: ref as React.RefObject<NoteEditorRef | null>,
  });
  const slashMenuSuggestions = useSlashCommandSuggestions();
  const jsonContent = useMemo(
    () =>
      initialContentRef.current && typeof initialContentRef.current === 'object'
        ? (initialContentRef.current as unknown as Record<string, unknown>)
        : null,
    []
  );
  const { content: refreshedContent } = useRefreshedAdminContent(jsonContent);
  const editorContent =
    refreshedContent && !(editable && hasLocalEditRef.current)
      ? (refreshedContent as JSONContent)
      : initialContentRef.current;

  const handleChange = useCallback(
    (json: JSONContent) => {
      hasLocalEditRef.current = true;
      onChange(json);
    },
    [onChange]
  );

  return (
    <div
      className={cn(fillContainer && 'flex h-full min-h-0 flex-1 flex-col', !fillContainer && className)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <RichTextEditor
        {...rest}
        content={editorContent}
        onChange={handleChange}
        ref={ref}
        className={cn(fillContainer && '[&_.ProseMirror]:min-h-full', !fillContainer && className)}
        minHeight={fillContainer ? 'full' : minHeight}
        autoHeight={autoHeight}
        editable={editable}
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
