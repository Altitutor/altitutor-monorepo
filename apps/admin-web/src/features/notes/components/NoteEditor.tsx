import { RichTextEditor, type RichTextEditorRef as NoteEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { JumpHighlightExtension } from '../extensions/JumpHighlightExtension';

export type { NoteEditorRef };

interface NoteEditorProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
}

/**
 * Tiptap ProseMirror JSON editor component.
 * Now a wrapper around the shared RichTextEditor.
 */
export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>((props, ref) => {
  return (
    <RichTextEditor
      {...props}
      ref={ref}
      minHeight="full"
      extensions={[JumpHighlightExtension]}
    />
  );
});

NoteEditor.displayName = 'NoteEditor';
