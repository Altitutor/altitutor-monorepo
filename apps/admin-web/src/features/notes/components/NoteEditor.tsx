'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useEffect, useCallback } from 'react';
import { cn } from '@/shared/utils';

interface NoteEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Tiptap markdown editor component
 */
export function NoteEditor({
  content,
  onChange,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[200px] p-4 focus:outline-none text-sm',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
      onChange(markdown);
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getMarkdown()) {
      editor.commands.setContent(content, { contentType: 'markdown' });
    }
  }, [content, editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus();
    }
  }, [autoFocus, editor]);

  if (!editor) {
    return <div className="text-muted-foreground">Loading editor...</div>;
  }

  return (
    <div className="border rounded-md">
      <EditorContent editor={editor} />
    </div>
  );
}
