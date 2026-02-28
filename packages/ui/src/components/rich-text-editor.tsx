'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { TextSelection } from '@tiptap/pm/state';
import { ImageUploadPlaceholderExtension } from './rich-text-editor-image-upload-placeholder';
import type { JSONContent } from '@tiptap/core';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { cn } from '../lib/cn';

export type { JSONContent };
export { PLACEHOLDER_NODE_NAME } from './rich-text-editor-image-upload-placeholder';

export interface RichTextEditorRef {
  focusToEnd: () => void;
  getEditor: () => Editor | null;
}

export interface RichTextEditorProps {
  /**
   * Content can be a JSON object (preferred), a JSON string, or a Markdown string.
   */
  content: JSONContent | string | null | undefined;
  /**
   * Callback when content changes. Returns the JSON structure.
   */
  onChange?: (json: JSONContent) => void;
  /**
   * Optional callback for markdown output if needed.
   */
  onMarkdownChange?: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
  /**
   * If true, uses markdown as the source of truth for the initial content.
   */
  isMarkdown?: boolean;
  /**
   * Minimum height of the editor.
   */
  minHeight?: string;
  /**
   * Whether the editor is editable.
   */
  editable?: boolean;
  /**
   * Optional configuration for mentions.
   * If provided, typing @ will trigger the mention suggestions.
   */
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
}

/**
 * Shared Tiptap Rich Text Editor component.
 * Standardized for JSONB storage but maintains compatibility with Markdown.
 */
export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  content,
  onChange,
  onMarkdownChange,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
  onEditorReady,
  isMarkdown = false,
  minHeight = '200px',
  editable = true,
  mentionSuggestions,
}, ref) => {
  // Tracks the last value emitted to avoid unnecessary re-renders/content resets
  const lastEmittedJsonRef = useRef<string>('');
  const lastEmittedMarkdownRef = useRef<string>('');
  
  // Refs for callbacks to avoid closure staleness without re-creating editor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  onMarkdownChangeRef.current = onMarkdownChange;

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
        // Generic text style support
      } as Record<string, unknown>),
      Typography,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
        includeChildren: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fileId: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-file-id'),
              renderHTML: (attrs) =>
                attrs.fileId ? { 'data-file-id': attrs.fileId } : {},
            },
          };
        },
      }).configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'my-3 rounded-md max-w-full h-auto cursor-pointer',
        },
      }),
      ImageUploadPlaceholderExtension,
      ...(mentionSuggestions ? [
        Mention.configure({
          HTMLAttributes: {
            class: 'bg-primary/10 text-primary px-1 rounded-sm font-medium cursor-pointer transition-colors hover:bg-primary/20',
            'data-mention': 'true',
          },
          suggestion: {
            ...mentionSuggestions,
          },
        }).extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => ({
                  'data-id': attributes.id,
                }),
              },
              label: {
                default: null,
                parseHTML: element => element.getAttribute('data-label') || element.innerText,
                renderHTML: attributes => ({
                  'data-label': attributes.label,
                }),
              },
              type: {
                default: null,
                parseHTML: element => element.getAttribute('data-type'),
                renderHTML: attributes => ({
                  'data-type': attributes.type,
                }),
              },
            }
          },
        })
      ] : []),
    ],
    content: (() => {
      if (!content) return { type: 'doc', content: [{ type: 'paragraph' }] };
      
      if (typeof content === 'string') {
        if (isMarkdown) return content; // Tiptap handles markdown string if extension is loaded
        
        try {
          return JSON.parse(content);
        } catch {
          // Fallback to treat as markdown if JSON parsing fails but isMarkdown wasn't set
          return content;
        }
      }
      
      return content;
    })(),
    editable,
    immediatelyRender: false,
    editorProps: {
      handleClick: (view, _pos, event) => {
        const target = event.target as HTMLElement;
        const mentionNode = target.closest('[data-mention]') as HTMLElement | null;
        if (mentionNode) {
          const id = mentionNode.getAttribute('data-id');
          const type = mentionNode.getAttribute('data-type');
          const label = mentionNode.innerText;
          
          if (id && type) {
            // Custom event for mention click
            const customEvent = new CustomEvent('mentionClick', { 
              detail: { id, type, label } 
            });
            window.dispatchEvent(customEvent);
            return true;
          }
        }

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
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-h1:mt-7 prose-h1:mb-1.5 prose-h2:mt-6 prose-h2:mb-1 prose-h3:mt-5 prose-h3:mb-1',
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
          '[&_.ProseMirror_ul>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_ol>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_h1:empty]:min-h-[2em]',
          '[&_.ProseMirror_h2:empty]:min-h-[1.75em]',
          '[&_.ProseMirror_h3:empty]:min-h-[1.5em]',
          className
        ),
        'data-placeholder': placeholder,
      },
      handlePaste: (view, event) => {
        if (!mentionSuggestions) return false;

        const pastedText = event.clipboardData?.getData('text/plain') || '';
        if (!pastedText) return false;

        const mentionType = view.state.schema.nodes.mention;
        if (!mentionType) return false;

        // Parse tag markers: @[type:id:displayText]
        const markerRegex = /@\[([^:\]]+):([^:\]]+):(.+?)\]/g;
        const hasMarker = markerRegex.test(pastedText);
        markerRegex.lastIndex = 0;
        if (!hasMarker) return false;

        event.preventDefault();

        const { state } = view;
        let tr = state.tr.deleteSelection();
        let insertPos = tr.selection.from;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = markerRegex.exec(pastedText)) !== null) {
          const [fullMatch, type, id, label] = match;

          // Insert plain text before marker
          const beforeText = pastedText.slice(lastIndex, match.index);
          if (beforeText) {
            tr = tr.insertText(beforeText, insertPos);
            insertPos += beforeText.length;
          }

          // Insert mention node
          const mentionNode = mentionType.create({ id, label, type });
          tr = tr.insert(insertPos, mentionNode);
          insertPos += mentionNode.nodeSize;

          lastIndex = match.index + fullMatch.length;
        }

        // Insert trailing plain text
        const trailingText = pastedText.slice(lastIndex);
        if (trailingText) {
          tr = tr.insertText(trailingText, insertPos);
          insertPos += trailingText.length;
        }

        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos, tr.doc.content.size))));
        view.dispatch(tr);
        view.focus();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      if (!editor) return;

      const json = editor.getJSON();
      const jsonString = JSON.stringify(json);

      if (jsonString !== lastEmittedJsonRef.current) {
        lastEmittedJsonRef.current = jsonString;
        onChangeRef.current?.(json);
      }

      if (onMarkdownChangeRef.current) {
        const markdown = editor.getMarkdown();
        if (markdown !== lastEmittedMarkdownRef.current) {
          lastEmittedMarkdownRef.current = markdown;
          onMarkdownChangeRef.current(markdown);
        }
      }
    },
  });

  // Sync content updates
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const incomingContent = content;
    let isEcho = false;

    if (typeof incomingContent === 'string') {
      if (isMarkdown) {
        isEcho = incomingContent === lastEmittedMarkdownRef.current;
      } else {
        isEcho = incomingContent === lastEmittedJsonRef.current;
      }
    } else {
      isEcho = JSON.stringify(incomingContent) === lastEmittedJsonRef.current;
    }

    if (isEcho) return;

    const parsedContent = (() => {
      if (!incomingContent) return { type: 'doc', content: [{ type: 'paragraph' }] };
      if (typeof incomingContent === 'string' && !isMarkdown) {
        try {
          return JSON.parse(incomingContent);
        } catch {
          return incomingContent;
        }
      }
      return incomingContent;
    })();

    editor.commands.setContent(parsedContent as JSONContent | string, { contentType: isMarkdown ? 'markdown' : undefined });
  }, [content, editor, isMarkdown]);

  // Sync editability
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor && !editor.isDestroyed) {
      const timeoutId = setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.focus();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [autoFocus, editor]);

  // Notify ready
  useEffect(() => {
    if (editor && !editor.isDestroyed && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

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

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || editor.isDestroyed || !editable) return;

    const editorElement = editor.view.dom;
    const editorRect = editorElement.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    if (clickX < editorRect.left || clickX > editorRect.right || clickY < editorRect.top || clickY > editorRect.bottom) {
      e.preventDefault();
      e.stopPropagation();

      let targetY = clickY;
      if (clickY < editorRect.top) targetY = editorRect.top;
      else if (clickY > editorRect.bottom) targetY = editorRect.bottom;

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
  }, [editor, editable]);

  if (!editor) {
    return <div className="text-muted-foreground animate-pulse p-4">Loading editor...</div>;
  }

  return (
    <div 
      className={cn("relative cursor-text flex flex-col w-full h-full", !editable && "cursor-default")}
      style={{ minHeight }}
      onClick={handleContainerClick}
    >
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
