'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Table,
  Trash2,
  Undo,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { Button } from './button'

export interface RichTextEditorBottomToolbarProps {
  editor: Editor | null
  /** `card` = bordered popover shell (default). `plain` = borderless, compact row for inline footers. */
  variant?: 'card' | 'plain'
}

type ToolbarMode = 'table' | 'text-selection' | 'default'

function isCursorInTable(editor: Editor): boolean {
  return (
    editor.isActive('table') ||
    editor.isActive('tableCell') ||
    editor.isActive('tableHeader')
  )
}

const toolbarIconButtonClass =
  'h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current'

/** Scrolls horizontally on narrow viewports; centers row when it fits. */
export const RICH_TEXT_BOTTOM_TOOLBAR_OUTER_CLASS =
  'border bg-popover rounded-lg shadow-lg w-full max-w-3xl mx-auto overflow-x-auto overscroll-x-contain'

export const RICH_TEXT_BOTTOM_TOOLBAR_PLAIN_OUTER_CLASS =
  'h-9 w-full overflow-x-auto overscroll-x-contain'

const TOOLBAR_INNER_PAD = 'px-2 sm:px-4 py-2'
const TOOLBAR_INNER_PLAIN = 'px-0'

/** Prevent editor blur when pressing toolbar controls (keeps selection for formatting). */
function handleToolbarMouseDown(event: MouseEvent) {
  event.preventDefault()
}

function ToolbarFrame({
  className,
  innerClassName,
  rowClassName,
  children,
}: {
  className: string
  innerClassName: string
  rowClassName: string
  children: ReactNode
}) {
  return (
    <div
      className={className}
      data-rich-text-toolbar
      onMouseDown={handleToolbarMouseDown}
    >
      <div className={innerClassName}>
        <div className={rowClassName}>{children}</div>
      </div>
    </div>
  )
}

function toolbarChrome(variant: 'card' | 'plain') {
  return {
    outer: variant === 'plain' ? RICH_TEXT_BOTTOM_TOOLBAR_PLAIN_OUTER_CLASS : RICH_TEXT_BOTTOM_TOOLBAR_OUTER_CLASS,
    inner: variant === 'plain' ? TOOLBAR_INNER_PLAIN : TOOLBAR_INNER_PAD,
    row: variant === 'plain' ? 'justify-start' : 'justify-center',
  }
}

/**
 * Persistent bottom toolbar that changes contextually based on editor state.
 * - Shows table row/column controls when the cursor is in a table
 * - Shows inline formatting when text is selected outside a table
 * - Shows general formatting options otherwise
 */
export function RichTextEditorBottomToolbar({
  editor,
  variant = 'card',
}: RichTextEditorBottomToolbarProps) {
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>('default')
  const chrome = toolbarChrome(variant)

  useEffect(() => {
    if (!editor) return

    const updateToolbarState = () => {
      const { selection } = editor.state
      const hasTextSelection = selection.content().size > 0
      if (isCursorInTable(editor)) {
        setToolbarMode('table')
      } else if (hasTextSelection) {
        setToolbarMode('text-selection')
      } else {
        setToolbarMode('default')
      }
    }

    editor.on('selectionUpdate', updateToolbarState)
    editor.on('update', updateToolbarState)
    editor.on('focus', updateToolbarState)
    editor.on('blur', updateToolbarState)
    updateToolbarState()

    return () => {
      editor.off('selectionUpdate', updateToolbarState)
      editor.off('update', updateToolbarState)
      editor.off('focus', updateToolbarState)
      editor.off('blur', updateToolbarState)
    }
  }, [editor])

  if (!editor) return null

  if (toolbarMode === 'table') {
    return (
      <ToolbarFrame
        className={chrome.outer}
        innerClassName={chrome.inner}
        rowClassName={cn('inline-flex min-w-full flex-nowrap items-center gap-1', chrome.row)}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          disabled={!editor.can().addColumnBefore()}
          className={toolbarIconButtonClass}
          title="Add column before"
        >
          <BetweenHorizontalStart className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          disabled={!editor.can().addColumnAfter()}
          className={toolbarIconButtonClass}
          title="Add column after"
        >
          <BetweenHorizontalEnd className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          disabled={!editor.can().deleteColumn()}
          className={toolbarIconButtonClass}
          title="Delete column"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          disabled={!editor.can().addRowBefore()}
          className={toolbarIconButtonClass}
          title="Add row before"
        >
          <BetweenVerticalStart className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          disabled={!editor.can().addRowAfter()}
          className={toolbarIconButtonClass}
          title="Add row after"
        >
          <BetweenVerticalEnd className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().deleteRow().run()}
          disabled={!editor.can().deleteRow()}
          className={toolbarIconButtonClass}
          title="Delete row"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </ToolbarFrame>
    )
  }

  if (toolbarMode === 'text-selection') {
    return (
      <ToolbarFrame
        className={chrome.outer}
        innerClassName={chrome.inner}
        rowClassName={cn('inline-flex min-w-full flex-nowrap items-center gap-1', chrome.row)}
      >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                'h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current',
                editor.isActive('bold') && 'bg-accent',
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
                'h-8 w-8 p-0 hover:bg-transparent',
                editor.isActive('italic') && 'bg-accent',
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
                'h-8 w-8 p-0 hover:bg-transparent',
                editor.isActive('strike') && 'bg-accent',
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
                'h-8 w-8 p-0 hover:bg-transparent',
                editor.isActive('code') && 'bg-accent',
              )}
              title="Inline Code"
            >
              <Code className="h-4 w-4" />
            </Button>
      </ToolbarFrame>
    )
  }

  return (
    <ToolbarFrame
      className={chrome.outer}
      innerClassName={chrome.inner}
      rowClassName={cn('inline-flex min-w-full flex-nowrap items-center gap-1', chrome.row)}
    >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current',
              editor.isActive('heading', { level: 1 }) && 'bg-accent',
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('heading', { level: 2 }) && 'bg-accent',
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('heading', { level: 3 }) && 'bg-accent',
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-6 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('bulletList') && 'bg-accent',
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
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('orderedList') && 'bg-accent',
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-6 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('blockquote') && 'bg-accent',
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
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('codeBlock') && 'bg-accent',
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
            className="h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current"
            title="Horizontal Rule"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            className={cn(
              'h-8 w-8 p-0 hover:bg-transparent',
              editor.isActive('table') && 'bg-accent',
            )}
            title="Insert Table"
          >
            <Table className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-6 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current"
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
            className="h-8 w-8 p-0 hover:bg-transparent hover:text-current dark:hover:text-current"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
    </ToolbarFrame>
  )
}
