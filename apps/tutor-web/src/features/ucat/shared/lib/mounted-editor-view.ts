import type { Editor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'

export function getMountedEditorView(editor: Editor | null): EditorView | null {
  if (!editor || editor.isDestroyed) return null

  try {
    return editor.view
  } catch {
    // TipTap keeps the editor instance alive while EditorContent mounts/unmounts,
    // but its view getter is unavailable during that transition.
    return null
  }
}
