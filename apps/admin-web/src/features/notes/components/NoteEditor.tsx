'use client';

import { useEditor, EditorContent, EditorContext } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useMemo, useRef } from 'react';
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
 * Simplified implementation following TipTap best practices
 */
export function NoteEditor({
  content,
  onChange,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
}: NoteEditorProps) {
  // Track last onChange value to prevent unnecessary updates
  const lastOnChangeRef = useRef<string>(content);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    contentType: 'markdown',
    content,
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
      handleClick: (view, pos, event) => {
        // If clicking below content, place cursor at end of document
        const { state } = view;
        const docSize = state.doc.content.size;
        
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords && coords.pos >= docSize) {
          const transaction = state.tr.setSelection(
            TextSelection.near(state.doc.resolve(docSize))
          );
          view.dispatch(transaction);
          view.focus();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (!editor) return;

      const markdown = editor.getMarkdown();
      
      // Only call onChange if content actually changed
      if (markdown !== lastOnChangeRef.current) {
        lastOnChangeRef.current = markdown;
        onChange(markdown);
      }
    },
  });

  // Sync external content changes to editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentMarkdown = editor.getMarkdown();
    
    // Only update if content actually changed
    if (currentMarkdown !== content) {
      editor.commands.setContent(content, {
        contentType: 'markdown',
        emitUpdate: false, // Prevent triggering onChange when setting externally
      });
      // Update ref to match new content
      lastOnChangeRef.current = content;
    }
  }, [content, editor]);

  // Auto-focus when requested
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

  // Memoize editor context value
  const editorContextValue = useMemo(
    () => (editor ? { editor } : null),
    [editor]
  );

  if (!editor) {
    return <div className="text-muted-foreground">Loading editor...</div>;
  }

  // Handle clicks in padding area to place cursor at nearest position
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || editor.isDestroyed) return;

    const editorElement = editor.view.dom;
    const editorRect = editorElement.getBoundingClientRect();
    const containerRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Check if click is outside the editor content area but inside the container
    const isLeftOfEditor = clickX < editorRect.left;
    const isRightOfEditor = clickX > editorRect.right;
    const isAboveEditor = clickY < editorRect.top;
    const isBelowEditor = clickY > editorRect.bottom;

    // Only handle clicks in padding areas
    if (isLeftOfEditor || isRightOfEditor || isAboveEditor || isBelowEditor) {
      e.preventDefault();
      e.stopPropagation();

      // Find the nearest position based on Y coordinate
      let targetY = clickY;
      
      // Clamp Y to editor bounds
      if (isAboveEditor) {
        targetY = editorRect.top;
      } else if (isBelowEditor) {
        targetY = editorRect.bottom;
      }

      // Use posAtCoords to find the nearest position
      const coords = editor.view.posAtCoords({ left: editorRect.left + (editorRect.width / 2), top: targetY });
      
      if (coords) {
        const { state } = editor.view;
        const transaction = state.tr.setSelection(
          TextSelection.near(state.doc.resolve(coords.pos))
        );
        editor.view.dispatch(transaction);
        editor.commands.focus();
      }
    }
  };

  return (
    <EditorContext.Provider value={editorContextValue || { editor: null }}>
      <div 
        className="relative h-full cursor-text flex flex-col" 
        data-placeholder={placeholder}
        onClick={handleContainerClick}
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
