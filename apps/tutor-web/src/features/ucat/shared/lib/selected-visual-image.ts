import type { Json } from '@altitutor/shared'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'

export type EditableVisualType = 'venn_diagram' | 'set_diagram' | 'vega_lite_chart'

export type SelectedVisualImage = {
  label: string
  src: string | null
  fileId: string | null
  location: string | null
  visualType: EditableVisualType | null
  visualSpec: Record<string, unknown> | null
  visualTitle: string | null
  visualAltText: string | null
  nodePos: number
}

export type SelectedImageAction = 'edit' | 'convert' | 'regenerate'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function editableVisualType(value: unknown): EditableVisualType | null {
  return value === 'venn_diagram' || value === 'set_diagram' || value === 'vega_lite_chart'
    ? value
    : null
}

export function getSelectedVisualImage(editor: Editor | null): SelectedVisualImage | null {
  if (!editor) return null
  const selection = editor.state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return null
  const attrs = selection.node.attrs as Record<string, unknown>
  const src = typeof attrs.src === 'string' ? attrs.src : null
  const fileId = typeof attrs.fileId === 'string' ? attrs.fileId : null
  const visualType = editableVisualType(attrs.visualType)
  const visualSpec = isRecord(attrs.visualSpec) ? structuredClone(attrs.visualSpec) : null
  const visualTitle = typeof attrs.visualTitle === 'string' ? attrs.visualTitle : null
  const visualAltText = typeof attrs.visualAltText === 'string'
    ? attrs.visualAltText
    : typeof attrs.alt === 'string'
      ? attrs.alt
      : null
  return {
    label: visualTitle?.trim() || visualAltText?.trim() || 'Selected image',
    src,
    fileId,
    location: `editor:${selection.from}`,
    visualType,
    visualSpec,
    visualTitle,
    visualAltText,
    nodePos: selection.from,
  }
}

export function selectedImageAction(image: SelectedVisualImage): SelectedImageAction {
  if (image.visualType && image.visualSpec) return 'edit'
  if (image.src?.startsWith('data:image/svg+xml')) return 'convert'
  return 'regenerate'
}

function imageMatches(attrs: Record<string, unknown>, selected: SelectedVisualImage): boolean {
  if (selected.fileId && attrs.fileId === selected.fileId) return true
  return Boolean(selected.src && attrs.src === selected.src)
}

export function replaceSelectedImageAttrs(
  editor: Editor,
  selected: SelectedVisualImage,
  attrs: Record<string, Json | undefined>,
): boolean {
  let position: number | null = null
  const directNode = editor.state.doc.nodeAt(selected.nodePos)
  if (directNode?.type.name === 'image' && imageMatches(directNode.attrs as Record<string, unknown>, selected)) {
    position = selected.nodePos
  } else {
    editor.state.doc.descendants((node, pos) => {
      if (position != null || node.type.name !== 'image') return position == null
      if (imageMatches(node.attrs as Record<string, unknown>, selected)) {
        position = pos
        return false
      }
      return true
    })
  }
  if (position == null) return false

  const node = editor.state.doc.nodeAt(position)
  if (!node) return false
  editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, {
    ...node.attrs,
    ...attrs,
  }))
  return true
}
