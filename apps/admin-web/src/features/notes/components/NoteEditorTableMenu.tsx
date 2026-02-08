'use client';

import type { Editor } from '@tiptap/react';
import { Button } from '@altitutor/ui';
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface NoteEditorTableMenuProps {
  editor: Editor;
}

/**
 * Table menu toolbar that appears when cursor is inside a table.
 * Provides controls for adding/removing rows and columns.
 */
export function NoteEditorTableMenu({ editor }: NoteEditorTableMenuProps) {
  if (!editor.isActive('table')) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1">
      {/* Row controls */}
      <div className="flex items-center gap-0.5 pr-1 border-r border-border">
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
      <div className="flex items-center gap-0.5 pr-1 border-r border-border">
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
  );
}
