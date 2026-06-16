import type { Editor } from '@tiptap/react'

export function isInsideRichTextToolbar(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-rich-text-toolbar]') != null
}

/** Wire TipTap focus/blur so a parent footer toolbar stays open while formatting. */
export function bindRichTextToolbarFocus(
  editor: Editor,
  onTextEditorActive: ((editor: Editor | null) => void) | undefined,
) {
  if (!onTextEditorActive) return

  const handleFocus = () => onTextEditorActive(editor)
  const handleBlur = ({ event }: { event: FocusEvent }) => {
    if (isInsideRichTextToolbar(event.relatedTarget)) {
      return
    }

    window.setTimeout(() => {
      if (isInsideRichTextToolbar(document.activeElement)) {
        return
      }
      onTextEditorActive(null)
    }, 0)
  }

  editor.on('focus', handleFocus)
  editor.on('blur', handleBlur)
}
