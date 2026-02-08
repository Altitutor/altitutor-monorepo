'use client';

import { useEditor, EditorContent, EditorContext } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/shared/utils';
import { NoteEditorBubbleMenu, NoteEditorFloatingMenu } from './NoteEditorToolbar';

interface NoteEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Tiptap markdown editor component
 * Follows React best practices with memoization and proper cleanup
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

  // Memoize editor configuration (content is set separately via useEffect)
  const editorConfig = useMemo(
    () => ({
      extensions: [StarterKit, Markdown],
      contentType: 'markdown' as const,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm max-w-none focus:outline-none',
            'prose-headings:font-semibold prose-headings:tracking-tight',
            'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
            'prose-li:my-1',
            '[&_.ProseMirror]:cursor-text',
            '[&_.ProseMirror>p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
            '[&_.ProseMirror>p.is-editor-empty:first-child::before]:text-muted-foreground',
            '[&_.ProseMirror>p.is-editor-empty:first-child::before]:float-left',
            '[&_.ProseMirror>p.is-editor-empty:first-child::before]:pointer-events-none',
            '[&_.ProseMirror>p.is-editor-empty:first-child::before]:h-0',
            className
          ),
          'data-placeholder': placeholder,
        },
        handleClick: (view: any, pos: number, event: MouseEvent) => {
          // If clicking below content, place cursor at end of last line
          const { state } = view;
          const docSize = state.doc.content.size;
          
          // Check if click is at or beyond the end of document
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (coords && coords.pos >= docSize) {
            // Place cursor at end of document (end of last line)
            const transaction = state.tr.setSelection(
              state.selection.constructor.near(state.doc.resolve(docSize))
            );
            view.dispatch(transaction);
            view.focus();
            return true;
          }
          return false;
        },
      },
    }),
    [className, placeholder]
  );

  // Memoize onChange handler
  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      // Don't trigger onChange if we're updating content programmatically
      if (isUpdatingRef.current || !editor) return;

      const markdown = editor.getMarkdown();
      lastExternalContentRef.current = markdown;
      onChange(markdown);
    },
    [onChange]
  );

  const editor = useEditor({
    ...editorConfig,
    content,
    onUpdate: handleUpdate,
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
    if (!autoFocus || !editor || editor.isDestroyed) return;

    // Small delay to ensure editor is fully rendered
    const timeoutId = setTimeout(() => {
      if (editor && !editor.isDestroyed) {
        editor.commands.focus();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [autoFocus, editor]);

  // Memoize editor context value - must be called before early return (Rules of Hooks)
  const editorContextValue = useMemo(
    () => (editor ? { editor } : null),
    [editor]
  );

  if (!editor) {
    return <div className="text-muted-foreground">Loading editor...</div>;
  }

  return (
    <EditorContext.Provider value={editorContextValue || { editor: null }}>
      <div 
        className="relative h-full cursor-text flex flex-col" 
        data-placeholder={placeholder}
        onClick={(e) => {
          // Handle clicks on the container (below content)
          if (!editor || editor.isDestroyed) return;
          
          const editorElement = editor.view.dom;
          const rect = editorElement.getBoundingClientRect();
          const clickY = e.clientY;
          
          // Check if click is below the editor content area
          if (clickY > rect.bottom) {
            e.preventDefault();
            e.stopPropagation();
            // Place cursor at end of document (end of last line)
            const docSize = editor.state.doc.content.size;
            editor.commands.setTextSelection(docSize);
            editor.commands.focus();
          }
        }}
      >
        <div className="flex-1 min-h-0">
          <EditorContent editor={editor} />
        </div>
        <BubbleMenu editor={editor}>
          <NoteEditorBubbleMenu />
        </BubbleMenu>
        <FloatingMenu editor={editor}>
          <NoteEditorFloatingMenu />
        </FloatingMenu>
      </div>
    </EditorContext.Provider>
  );
}
