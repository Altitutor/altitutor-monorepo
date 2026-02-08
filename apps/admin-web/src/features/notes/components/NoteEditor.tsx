'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useEffect, useRef } from 'react';
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
  const isUpdatingRef = useRef(false);
  const lastExternalContentRef = useRef<string>(content);
  const isMountedRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[200px] p-4 focus:outline-none text-sm',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // Don't trigger onChange if we're updating content programmatically
      if (isUpdatingRef.current) return;
      
      const markdown = editor.getMarkdown();
      lastExternalContentRef.current = markdown;
      onChange(markdown);
    },
  });

  // Mark as mounted after first render
  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  // Update editor content when prop changes externally (but only if different and mounted)
  useEffect(() => {
    if (!editor || editor.isDestroyed || !isMountedRef.current) return;
    
    // Skip if we're already updating
    if (isUpdatingRef.current) return;
    
    // Only update if content changed externally (not from our own onChange)
    if (content === lastExternalContentRef.current) return;
    
    // Wait a tick to ensure editor is fully mounted before updating
    const timeoutId = setTimeout(() => {
      if (!editor || editor.isDestroyed || isUpdatingRef.current) return;
      
      // Double-check content still differs
      if (content === lastExternalContentRef.current) return;
      
      try {
        isUpdatingRef.current = true;
        editor.commands.setContent(content, { contentType: 'markdown' });
        lastExternalContentRef.current = content;
        // Reset flag after a brief delay to allow transaction to complete
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 10);
      } catch (error) {
        console.error('Error updating editor content:', error);
        isUpdatingRef.current = false;
      }
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [content, editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor && !editor.isDestroyed) {
      // Small delay to ensure editor is fully rendered
      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.focus();
        }
      }, 100);
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
