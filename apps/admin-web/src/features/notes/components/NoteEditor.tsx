'use client';

import { useEditor, EditorContent, EditorContext } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/shared/utils';
import { NoteEditorBubbleMenu, NoteEditorFloatingMenu } from './NoteEditorToolbar';

interface NoteEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export interface NoteEditorRef {
  focus: () => void;
}

/**
 * Tiptap markdown editor component
 * Simplified implementation following TipTap best practices
 */
export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>(({
  content,
  onChange,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
}, ref) => {
  // Track last onChange value to prevent unnecessary updates
  const lastOnChangeRef = useRef<string>(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Ensure input rules are enabled for markdown shortcuts
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
        // Configure markdown parsing options
        markedOptions: {
          gfm: true, // GitHub Flavored Markdown for better list support
        },
      }),
    ],
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:56',message:'handleClick called',data:{pos,docSize:view.state.doc.content.size},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
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
      handleKeyDown: (view, event) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:72',message:'handleKeyDown called',data:{key:event.key,code:event.code,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return false; // Let TipTap handle it
      },
    },
    onUpdate: ({ editor }) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:73',message:'onUpdate triggered',data:{markdown:editor.getMarkdown(),html:editor.getHTML()},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (!editor) return;

      let markdown = editor.getMarkdown();
      
      // Normalize markdown: replace &nbsp; in empty list items and headings with proper markdown
      // This fixes rendering issues with empty nodes
      markdown = markdown.replace(/^(\s*[-*+])\s+&nbsp;(\s*)$/gm, '$1 $2'); // Empty list items: "- &nbsp;" -> "- "
      markdown = markdown.replace(/^(#{1,6})\s+&nbsp;(\s*)$/gm, '$1 $2'); // Empty headings: "# &nbsp;" -> "# "
      markdown = markdown.replace(/&nbsp;/g, ' '); // Replace remaining &nbsp; with regular spaces
      
      // Only call onChange if content actually changed
      if (markdown !== lastOnChangeRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:79',message:'onChange called',data:{oldMarkdown:lastOnChangeRef.current,newMarkdown:markdown},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        lastOnChangeRef.current = markdown;
        onChange(markdown);
      }
    },
  });

  // Sync external content changes to editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    let currentMarkdown = editor.getMarkdown();
    // Normalize current markdown for comparison (same normalization as in onUpdate)
    currentMarkdown = currentMarkdown.replace(/^(\s*[-*+])\s+&nbsp;(\s*)$/gm, '$1 $2');
    currentMarkdown = currentMarkdown.replace(/^(#{1,6})\s+&nbsp;(\s*)$/gm, '$1 $2');
    currentMarkdown = currentMarkdown.replace(/&nbsp;/g, ' ');
    
    // Normalize external content for comparison
    let normalizedContent = content.replace(/&nbsp;/g, ' ');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:87',message:'Content sync effect',data:{currentMarkdown,externalContent:normalizedContent,willUpdate:currentMarkdown!==normalizedContent},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Only update if content actually changed
    if (currentMarkdown !== normalizedContent) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteEditor.tsx:93',message:'setContent called',data:{content},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      editor.commands.setContent(content, {
        contentType: 'markdown',
        emitUpdate: false, // Prevent triggering onChange when setting externally
      });
      // Update ref to match new content
      lastOnChangeRef.current = content;
    }
  }, [content, editor]);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editor && !editor.isDestroyed) {
        // Move cursor to end of document
        const { state } = editor.view;
        const docSize = state.doc.content.size;
        const transaction = state.tr.setSelection(
          TextSelection.near(state.doc.resolve(docSize))
        );
        editor.view.dispatch(transaction);
        editor.commands.focus();
      }
    },
  }), [editor]);

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
});

NoteEditor.displayName = 'NoteEditor';
