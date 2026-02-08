'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@altitutor/ui';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Table,
  Undo,
  Redo,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { cn } from '@/shared/utils';

interface NoteEditorBottomToolbarProps {
  editor: Editor | null;
}

type ToolbarMode = 'text-selection' | 'table' | 'default';

/**
 * Persistent bottom toolbar that changes contextually based on editor state.
 * - Shows inline formatting when text is selected
 * - Shows table controls when cursor is in a table
 * - Shows general formatting options otherwise
 */
export function NoteEditorBottomToolbar({ editor }: NoteEditorBottomToolbarProps) {
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>('default');

  useEffect(() => {
    if (!editor) return;

    const updateToolbarState = () => {
      const { selection } = editor.state;
      const hasTextSelection = selection.content().size > 0;
      const inTable = editor.isActive('table');

      // Determine toolbar mode
      if (inTable) {
        setToolbarMode('table');
      } else if (hasTextSelection) {
        setToolbarMode('text-selection');
      } else {
        setToolbarMode('default');
      }
    };

    // Update on selection changes
    editor.on('selectionUpdate', updateToolbarState);
    editor.on('update', updateToolbarState);
    editor.on('focus', updateToolbarState);
    editor.on('blur', updateToolbarState);

    // Initial update
    updateToolbarState();

    return () => {
      editor.off('selectionUpdate', updateToolbarState);
      editor.off('update', updateToolbarState);
      editor.off('focus', updateToolbarState);
      editor.off('blur', updateToolbarState);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  // Table toolbar mode
  if (toolbarMode === 'table') {
    return (
      <div className="border bg-popover rounded-lg shadow-lg w-full max-w-3xl mx-auto">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 justify-center flex-nowrap">
            {/* Row controls */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                className="h-8 w-8 p-0"
                title="Add row above"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="h-8 w-8 p-0"
                title="Add row below"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Delete row"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Column controls */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="h-8 w-8 p-0"
                title="Add column left"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="h-8 w-8 p-0"
                title="Add column right"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Delete column"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Delete table */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              title="Delete table"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Text selection toolbar mode
  if (toolbarMode === 'text-selection') {
    return (
      <div className="border bg-popover rounded-lg shadow-lg w-full max-w-3xl mx-auto">
        <div className="px-4 py-2">
          <div className="flex items-center gap-1 justify-center flex-nowrap">
            {/* Inline formatting */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('bold') && 'bg-accent'
              )}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('italic') && 'bg-accent'
              )}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('strike') && 'bg-accent'
              )}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('code') && 'bg-accent'
              )}
              title="Inline Code"
            >
              <Code className="h-4 w-4" />
            </Button>

            {/* Note: Heading buttons removed from text-selection mode to avoid duplication.
                Headings are available in the default toolbar mode when no text is selected. */}
          </div>
        </div>
      </div>
    );
  }

  // Default toolbar mode (cursor position, no selection)
  return (
    <div className="border bg-popover rounded-lg shadow-lg w-full max-w-3xl mx-auto">
      <div className="px-4 py-2">
        <div className="flex items-center gap-1 justify-center flex-nowrap">
          {/* Headings */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 px-2 text-xs',
              editor.isActive('heading', { level: 1 }) && 'bg-accent'
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4 mr-1" />
            H1
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 px-2 text-xs',
              editor.isActive('heading', { level: 2 }) && 'bg-accent'
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4 mr-1" />
            H2
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 px-2 text-xs',
              editor.isActive('heading', { level: 3 }) && 'bg-accent'
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4 mr-1" />
            H3
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Lists */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-accent'
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') && 'bg-accent'
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Block elements */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('blockquote') && 'bg-accent'
            )}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('codeBlock') && 'bg-accent'
            )}
            title="Code Block"
          >
            <Code2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="h-8 w-8 p-0"
            title="Horizontal Rule"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('table') && 'bg-accent'
            )}
            title="Insert Table"
          >
            <Table className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* History */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
