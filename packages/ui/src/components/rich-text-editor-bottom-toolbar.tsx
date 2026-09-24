'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
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
import {
  navActiveStyles,
  navHoverStyles,
  navItemTransitionStyles,
} from '../lib/styles'
import { Button } from './button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

/** Lucide-style icons: a column/row block + plus on the insert side (clearer than Between*). */
function TableIconBase({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

function InsertColumnBeforeIcon({ className }: { className?: string }) {
  return (
    <TableIconBase className={className}>
      <rect x="14" y="3" width="7" height="18" rx="1" />
      <path d="M8 12H2" />
      <path d="M5 9v6" />
    </TableIconBase>
  )
}

function InsertColumnAfterIcon({ className }: { className?: string }) {
  return (
    <TableIconBase className={className}>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <path d="M16 12h6" />
      <path d="M19 9v6" />
    </TableIconBase>
  )
}

function InsertRowBeforeIcon({ className }: { className?: string }) {
  return (
    <TableIconBase className={className}>
      <rect x="3" y="14" width="18" height="7" rx="1" />
      <path d="M12 8V2" />
      <path d="M9 5h6" />
    </TableIconBase>
  )
}

function InsertRowAfterIcon({ className }: { className?: string }) {
  return (
    <TableIconBase className={className}>
      <rect x="3" y="3" width="18" height="7" rx="1" />
      <path d="M12 16v6" />
      <path d="M9 19h6" />
    </TableIconBase>
  )
}

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

const toolbarIconButtonClass = cn(
  'h-8 w-8 p-0',
  navItemTransitionStyles,
  navHoverStyles,
)

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

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Span keeps tooltips working when the button is disabled */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              toolbarIconButtonClass,
              active && navActiveStyles,
            )}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
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
    <TooltipProvider delayDuration={300}>
      <div
        className={className}
        data-rich-text-toolbar
        onMouseDown={handleToolbarMouseDown}
      >
        <div className={innerClassName}>
          <div className={rowClassName}>{children}</div>
        </div>
      </div>
    </TooltipProvider>
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
        <ToolbarIconButton
          label="Add column before"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          disabled={!editor.can().addColumnBefore()}
        >
          <InsertColumnBeforeIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Add column after"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          disabled={!editor.can().addColumnAfter()}
        >
          <InsertColumnAfterIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Delete column"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          disabled={!editor.can().deleteColumn()}
        >
          <Trash2 className="h-4 w-4" />
        </ToolbarIconButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarIconButton
          label="Add row before"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          disabled={!editor.can().addRowBefore()}
        >
          <InsertRowBeforeIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Add row after"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          disabled={!editor.can().addRowAfter()}
        >
          <InsertRowAfterIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Delete row"
          onClick={() => editor.chain().focus().deleteRow().run()}
          disabled={!editor.can().deleteRow()}
        >
          <Trash2 className="h-4 w-4" />
        </ToolbarIconButton>
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
        <ToolbarIconButton
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Inline Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
        >
          <Code className="h-4 w-4" />
        </ToolbarIconButton>
      </ToolbarFrame>
    )
  }

  return (
    <ToolbarFrame
      className={chrome.outer}
      innerClassName={chrome.inner}
      rowClassName={cn('inline-flex min-w-full flex-nowrap items-center gap-1', chrome.row)}
    >
      <ToolbarIconButton
        label="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarIconButton>

      <div className="mx-1 h-6 w-px bg-border" />

      <ToolbarIconButton
        label="Bullet List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Numbered List"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarIconButton>

      <div className="mx-1 h-6 w-px bg-border" />

      <ToolbarIconButton
        label="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        <Quote className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Code Block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
      >
        <Code2 className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Insert Table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        active={editor.isActive('table')}
      >
        <Table className="h-4 w-4" />
      </ToolbarIconButton>

      <div className="mx-1 h-6 w-px bg-border" />

      <ToolbarIconButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo className="h-4 w-4" />
      </ToolbarIconButton>
    </ToolbarFrame>
  )
}
