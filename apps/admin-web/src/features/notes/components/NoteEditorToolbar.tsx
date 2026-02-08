'use client';

import { useCurrentEditor } from '@tiptap/react';
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
  Undo,
  Redo,
} from 'lucide-react';
import { cn } from '@/shared/utils';

/**
 * Bubble menu toolbar that appears when text is selected
 * Provides quick access to StarterKit formatting features
 */
export function NoteEditorBubbleMenu() {
  const { editor } = useCurrentEditor();

  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1">
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
    </div>
  );
}

/**
 * Floating menu toolbar that appears when cursor is on a new line
 * Provides access to block-level formatting features
 */
export function NoteEditorFloatingMenu() {
  const { editor } = useCurrentEditor();

  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1">
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
      <div className="w-px h-6 bg-border mx-1" />
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
  );
}
