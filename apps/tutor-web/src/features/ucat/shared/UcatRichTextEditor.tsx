import { useCallback, useRef } from 'react'
import type { Json } from '@altitutor/shared'
import { RichTextEditor, type JSONContent, type RichTextEditorRef } from '@altitutor/ui'
import { TextSelection } from '@tiptap/pm/state'
import type { SetImageOptions } from '@tiptap/extension-image'
import { uploadUcatImage } from '@/features/ucat/shared/ucatImages'

export type UcatRichTextValue = Json | null | undefined

export interface UcatRichTextEditorProps {
  value: UcatRichTextValue
  onChange?: (value: Json) => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
  editable?: boolean
  minHeight?: string
  stemId?: string | null
  /** If set to 1, ensures only a single image is kept in the document (for answer options). */
  maxImagesPerDocument?: number
  /** Whether image uploads are enabled for this editor instance. Defaults to true. */
  enableImages?: boolean
  /** Optional callback with the set of image file IDs present after a drop operation. */
  onImageFileIdsChange?: (fileIds: string[]) => void
}

function toJsonContent(value: UcatRichTextValue): JSONContent | null {
  if (!value || typeof value !== 'object') {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
  }
  return value as JSONContent
}

function fromJsonContent(json: JSONContent): Json {
  return json as unknown as Json
}

export function UcatRichTextEditor({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
  editable = true,
  minHeight,
  stemId,
  maxImagesPerDocument,
  enableImages,
  onImageFileIdsChange,
}: UcatRichTextEditorProps) {
  const editorRef = useRef<RichTextEditorRef | null>(null)

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      if (!editable) return

      // If images are disabled for this editor, let the event bubble through.
      if (enableImages === false) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const native = event.nativeEvent
      const dataTransfer = native.dataTransfer
      if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) return

      const files: File[] = Array.from(dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      )

      if (files.length === 0) return

      const editor = editorRef.current?.getEditor()
      if (!editor) return

      const collectedFileIds: string[] = []

      // Compute a base insertion position that snaps to the nearest paragraph
      // boundary relative to the drop coordinates.
      const view = editor.view
      const state = view.state
      let insertPos = state.selection.from
      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      })

      if (coords) {
        const doc = state.doc
        let $pos = doc.resolve(coords.pos)

        // Special handling when the position resolves at the top-level doc
        // between block nodes (common when dropping in the gap between
        // paragraphs). In that case, snap to the nearest block boundary,
        // not to the very start/end of the whole document.
        if ($pos.parent === doc) {
          const before = doc.childBefore(coords.pos)
          const after = doc.childAfter(coords.pos)

          if (!before.node && after.node) {
            // At the very top: snap before the first block
            insertPos = after.offset
          } else if (before.node && !after.node) {
            // At the very bottom: snap after the last block
            insertPos = before.offset + before.node.nodeSize
          } else if (before.node && after.node) {
            const beforeEnd = before.offset + before.node.nodeSize
            const distToBefore = coords.pos - beforeEnd
            const distToAfter = after.offset - coords.pos
            // Snap to whichever block boundary is closer
            insertPos = distToBefore <= distToAfter ? beforeEnd : after.offset
          }
        } else {
          // Inside some nested structure: walk up to the nearest block node
          // (typically a paragraph) and snap before/after that block based on
          // the drop vertical position.
          while ($pos.depth > 0 && !$pos.parent.isBlock) {
            $pos = doc.resolve($pos.before())
          }
          const blockStart = $pos.start()
          const blockEnd = $pos.end()
          const mid = (blockStart + blockEnd) / 2
          // If dropped in the top half, insert before the paragraph; otherwise after.
          insertPos = coords.pos < mid ? blockStart : blockEnd
        }
      }

      for (const file of files) {
        try {
          const { fileId, signedUrl } = await uploadUcatImage({ file, stemId })
          collectedFileIds.push(fileId)

          // Optionally enforce max images per document (e.g. answer options)
          if (maxImagesPerDocument === 1) {
            const { state: currentState, dispatch } = editor.view
            let tr = currentState.tr
            currentState.doc.descendants((node, pos) => {
              if (node.type.name === 'image') {
                tr = tr.delete(pos, pos + node.nodeSize)
              }
              return true
            })
            if (tr.docChanged) {
              dispatch(tr)
            }
          }

          // Move the selection to the computed insertion position (snapped to
          // the nearest paragraph boundary) so the image is inserted on its own
          // line between paragraphs.
          {
            const { state: currentState, dispatch } = editor.view
            const docSize = currentState.doc.content.size
            const safePos = Math.max(0, Math.min(insertPos, docSize))
            const $resolved = currentState.doc.resolve(safePos)
            const tr = currentState.tr.setSelection(
              TextSelection.near($resolved)
            )
            dispatch(tr)
          }

          editor
            .chain()
            .focus()
            .setImage({
              src: signedUrl,
              alt: file.name,
              title: file.name,
              // Allow consumer code and ProseMirror schema to store an extra fileId attribute.
              fileId,
            } as SetImageOptions & { fileId?: string })
            .run()
        } catch (error) {
          console.error('Failed to upload UCAT image for rich text editor:', error)
        }
      }
      if (collectedFileIds.length > 0 && typeof onImageFileIdsChange === 'function') {
        const limited =
          typeof maxImagesPerDocument === 'number' && maxImagesPerDocument > 0
            ? collectedFileIds.slice(-maxImagesPerDocument)
            : collectedFileIds
        onImageFileIdsChange(limited)
      }
    },
    [editable, stemId, maxImagesPerDocument, enableImages, onImageFileIdsChange]
  )

  return (
    <div
      className={className}
      style={{ minHeight }}
      onDragOver={(e) => {
        if (!editable) return
        e.preventDefault()
      }}
      onDrop={handleDrop}
    >
      <RichTextEditor
        ref={editorRef}
        content={toJsonContent(value)}
        onChange={onChange ? (json) => onChange(fromJsonContent(json)) : undefined}
        placeholder={placeholder}
        autoFocus={autoFocus}
        editable={editable}
        minHeight={minHeight}
      />
    </div>
  )
}

