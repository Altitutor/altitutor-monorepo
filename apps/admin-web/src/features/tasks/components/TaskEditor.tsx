'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/shared/utils';

interface TaskEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

export interface TaskEditorRef {
  focusToEnd: () => void;
  getEditor: () => Editor | null;
}

/**
 * Tiptap markdown editor component for task descriptions.
 *
 * The editor is the source of truth while the user edits. External content
 * changes (initial load, navigating to another task) are detected by comparing
 * the incoming `content` prop against the last value the editor emitted via
 * `onChange`. This avoids a lossy markdown round-trip that would reset
 * formatting applied through the toolbar.
 */
export const TaskEditor = forwardRef<TaskEditorRef, TaskEditorProps>(({
  content,
  onChange,
  className,
  placeholder = 'Add description...',
  autoFocus = false,
  onEditorReady,
}, ref) => {
  // Tracks the last markdown value emitted by onUpdate → onChange.
  // Used to distinguish editor-originated content changes (echoes) from
  // genuinely external ones (initial load, task navigation).
  const lastOnChangeRef = useRef<string>(content);
  // Keep onChange in a ref so the onUpdate closure always calls the latest version
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
      TextStyleKit.configure({
        fontFamily: {
          types: ['textStyle'],
        },
        fontSize: {
          types: ['textStyle'],
        },
        color: {
          types: ['textStyle'],
        },
        backgroundColor: {
          types: ['textStyle'],
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
        includeChildren: true,
      }),
    ],
    contentType: 'markdown',
    content: content || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-1',
          'prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
          'prose-td:border prose-td:border-border prose-td:p-2',
          '[&_.ProseMirror]:cursor-text',
          '[&_p.is-empty.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_p.is-empty.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_p.is-empty.is-editor-empty:first-child::before]:float-left',
          '[&_p.is-empty.is-editor-empty:first-child::before]:h-0',
          '[&_p.is-empty.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!opacity-100',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!visible',
          // Ensure empty list items and headings are visible
          '[&_.ProseMirror_ul>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_ol>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_h1:empty]:min-h-[2em]',
          '[&_.ProseMirror_h2:empty]:min-h-[1.75em]',
          '[&_.ProseMirror_h3:empty]:min-h-[1.5em]',
          className
        ),
        'data-placeholder': placeholder,
      },
      handleClick: (view, _pos, event) => {
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

      let markdown = editor.getMarkdown();

      // Normalize &nbsp; that TipTap inserts as placeholders in empty nodes
      markdown = markdown.replace(/^(\s*[-*+])\s+&nbsp;(\s*)$/gm, '$1 $2');
      markdown = markdown.replace(/^(#{1,6})\s+&nbsp;(\s*)$/gm, '$1 $2');
      markdown = markdown.replace(/&nbsp;/g, ' ');

      if (markdown !== lastOnChangeRef.current) {
        lastOnChangeRef.current = markdown;
        onChangeRef.current(markdown);
      }
    },
  });

  // Sync truly-external content changes to the editor.
  // If `content` matches the last value the editor emitted via onChange, it is
  // an echo of an editor-driven change and we must NOT call setContent (which
  // would rebuild the ProseMirror state and destroy any in-progress formatting).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const isEcho = content === lastOnChangeRef.current;

    // Content matches what the editor last emitted – nothing to sync
    if (isEcho) return;

    // Genuinely external change (initial load, task navigation, etc.)
    lastOnChangeRef.current = content;
    editor.commands.setContent(content, { contentType: 'markdown' });
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

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && !editor.isDestroyed && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Expose editor methods via ref
  useImperativeHandle(ref, () => ({
    focusToEnd: () => {
      if (!editor || editor.isDestroyed) return;
      const { state } = editor.view;
      const docSize = state.doc.content.size;
      const transaction = state.tr.setSelection(
        TextSelection.near(state.doc.resolve(docSize))
      );
      editor.view.dispatch(transaction);
      editor.commands.focus();
    },
    getEditor: () => editor,
  }), [editor]);

  if (!editor) {
    return <div className="text-muted-foreground">Loading editor...</div>;
  }

  // Handle clicks in padding area to place cursor at nearest position
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || editor.isDestroyed) return;

    const editorElement = editor.view.dom;
    const editorRect = editorElement.getBoundingClientRect();
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
    <div 
      className="relative cursor-text flex flex-col min-h-[200px]" 
      data-placeholder={placeholder}
      onClick={handleContainerClick}
    >
      <EditorContent editor={editor} />
    </div>
  );
});

TaskEditor.displayName = 'TaskEditor';
