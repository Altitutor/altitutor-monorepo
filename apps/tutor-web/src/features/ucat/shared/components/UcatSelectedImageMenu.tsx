'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Button } from '@altitutor/ui'
import { MoreHorizontal, Pencil, Sparkles, Wand2 } from 'lucide-react'
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual'
import {
  getSelectedVisualImage,
  selectedImageAction,
  type SelectedVisualImage,
} from '@/features/ucat/shared/lib/selected-visual-image'

type AnchorPosition = { top: number; left: number }

export function UcatSelectedImageMenu({
  editor,
  onEditVisual,
  onUseImageWithAi,
}: {
  editor: Editor | null
  onEditVisual?: (image: SelectedVisualImage, editor: Editor) => void
  onUseImageWithAi?: (image: SelectedVisualImage, editor: Editor) => void
}) {
  const [selectedImage, setSelectedImage] = useState<SelectedVisualImage | null>(null)
  const [anchor, setAnchor] = useState<AnchorPosition | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuOpenRef = useRef(false)
  const clearSelectionTimerRef = useRef<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editor) {
      setSelectedImage(null)
      return
    }
    const update = () => {
      const next = getSelectedVisualImage(editor)
      if (clearSelectionTimerRef.current) window.clearTimeout(clearSelectionTimerRef.current)
      if (next) {
        setSelectedImage(next)
        return
      }
      clearSelectionTimerRef.current = window.setTimeout(() => {
        if (!menuOpenRef.current) setSelectedImage(null)
      }, 1000)
    }
    update()
    const clearOnEditorPointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof HTMLImageElement || (target instanceof Element && target.closest('img'))) return
      menuOpenRef.current = false
      setMenuOpen(false)
      setSelectedImage(null)
    }
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.view.dom.addEventListener('pointerdown', clearOnEditorPointer, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.view.dom.removeEventListener('pointerdown', clearOnEditorPointer, true)
      if (clearSelectionTimerRef.current) window.clearTimeout(clearSelectionTimerRef.current)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || !selectedImage) {
      setAnchor(null)
      return
    }
    const updateAnchor = () => {
      const nodeDom = editor.view.nodeDOM(selectedImage.nodePos)
      const element = nodeDom instanceof HTMLElement ? nodeDom : null
      const image = element instanceof HTMLImageElement ? element : element?.querySelector('img')
      const target = image instanceof HTMLElement ? image : element
      if (!target) {
        setAnchor(null)
        return
      }
      const rect = target.getBoundingClientRect()
      const dialog = target.closest('[role="dialog"]')
      const dialogRect = dialog?.getBoundingClientRect()
      if (!dialogRect || rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        setAnchor(null)
        return
      }
      setAnchor({
        top: Math.max(8, rect.top - dialogRect.top + 8),
        left: Math.max(8, Math.min(dialogRect.width - 44, rect.right - dialogRect.left - 44)),
      })
    }
    updateAnchor()
    window.addEventListener('resize', updateAnchor)
    window.addEventListener('scroll', updateAnchor, true)
    const resizeObserver = new ResizeObserver(updateAnchor)
    const nodeDom = editor.view.nodeDOM(selectedImage.nodePos)
    if (nodeDom instanceof Element) resizeObserver.observe(nodeDom)
    return () => {
      window.removeEventListener('resize', updateAnchor)
      window.removeEventListener('scroll', updateAnchor, true)
      resizeObserver.disconnect()
    }
  }, [editor, selectedImage])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      menuOpenRef.current = false
      setMenuOpen(false)
      if (editor && !getSelectedVisualImage(editor)) setSelectedImage(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      menuOpenRef.current = false
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [editor, menuOpen])

  if (!editor || !selectedImage || !anchor) return null
  const action = selectedImageAction(selectedImage)
  if (action === 'edit' ? !onEditVisual : !onUseImageWithAi) return null
  const actionLabel = action === 'edit'
    ? 'Edit visual'
    : action === 'convert'
      ? 'Convert to editable visual'
      : 'Regenerate with AI'
  const ActionIcon = action === 'edit' ? Pencil : action === 'convert' ? Wand2 : Sparkles
  const runAction = () => {
    menuOpenRef.current = false
    setMenuOpen(false)
    if (action === 'edit') onEditVisual?.(selectedImage, editor)
    else onUseImageWithAi?.(selectedImage, editor)
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-[120]"
      style={anchor}
      data-selected-image-menu
      onPointerDownCapture={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-image-menu-trigger]')) return
        event.preventDefault()
        const nextOpen = !menuOpenRef.current
        menuOpenRef.current = nextOpen
        setMenuOpen(nextOpen)
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`${tutorBtnOutline} size-9 bg-background/95 shadow-md backdrop-blur-sm`}
        aria-label="Image actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-image-menu-trigger
        onClick={() => {
          if (menuOpenRef.current) return
          menuOpenRef.current = true
          setMenuOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          const nextOpen = !menuOpenRef.current
          menuOpenRef.current = nextOpen
          setMenuOpen(nextOpen)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {menuOpen ? (
        <div role="menu" aria-label="Image actions" className={tutorCardCn('absolute right-0 top-11 min-w-56 p-1.5')}>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              runAction()
            }}
            onClick={(event) => {
              if (event.detail === 0) runAction()
            }}
          >
            <ActionIcon className="h-4 w-4" />
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
