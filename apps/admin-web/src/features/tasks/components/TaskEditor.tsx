import { RichTextEditor, type RichTextEditorRef as TaskEditorRef, type JSONContent } from '@altitutor/ui';
import { forwardRef } from 'react';
import type { Editor } from '@tiptap/react';

export type { TaskEditorRef };

interface TaskEditorProps {
  content: JSONContent | string | null | undefined;
  onChange: (json: JSONContent) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

/**
 * Tiptap markdown editor component for task descriptions.
 * Now a wrapper around the shared RichTextEditor.
 */
export const TaskEditor = forwardRef<TaskEditorRef, TaskEditorProps>((props, ref) => {
  return (
    <RichTextEditor
      {...props}
      ref={ref}
    />
  );
});

TaskEditor.displayName = 'TaskEditor';
