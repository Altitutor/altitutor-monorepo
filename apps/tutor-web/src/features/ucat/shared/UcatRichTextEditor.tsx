import { useCallback, useRef } from 'react'
import type { Json } from '@altitutor/shared'
import {
  RichTextEditor,
  type JSONContent,
  type RichTextEditorRef,
  PLACEHOLDER_NODE_NAME,
} from '@altitutor/ui'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
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

  /** Shared logic: insert placeholders, upload, replace (or remove on error) at a given position. */
  const processImagesAtPosition = useCallback(
    async (editor: Editor, files: File[], insertPos: number) => {
      const collectedFileIds: string[] = []
      for (const file of files) {
        const placeholderId = crypto.randomUUID()

        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: PLACEHOLDER_NODE_NAME,
            attrs: { id: placeholderId },
          })
          .run()

        try {
          const { fileId, signedUrl } = await uploadUcatImage({ file, stemId })
          collectedFileIds.push(fileId)

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

          const state = editor.state
          const doc = state.doc
          const schema = state.schema
          let placeholderPos: number | null = null
          let placeholderSize = 0
          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (
              node.type.name === PLACEHOLDER_NODE_NAME &&
              node.attrs.id === placeholderId
            ) {
              placeholderPos = pos
              placeholderSize = node.nodeSize
              return false
            }
            return true
          })

          if (placeholderPos !== null) {
            const imageNode = schema.nodes.image.create({
              src: signedUrl,
              alt: file.name,
              title: file.name,
              fileId,
            } as Record<string, unknown>)
            const tr = state.tr
              .delete(placeholderPos, placeholderPos + placeholderSize)
              .insert(placeholderPos, imageNode)
            editor.view.dispatch(tr)
            insertPos = placeholderPos + imageNode.nodeSize
          } else {
            const docSize = doc.content.size
            const safePos = Math.max(0, Math.min(insertPos, docSize))
            const $resolved = doc.resolve(safePos)
            editor.view.dispatch(
              state.tr.setSelection(TextSelection.near($resolved))
            )
            editor
              .chain()
              .focus()
              .setImage({
                src: signedUrl,
                alt: file.name,
                title: file.name,
                fileId,
              } as SetImageOptions & { fileId?: string })
              .run()
            insertPos = editor.state.selection.from
          }
        } catch (error) {
          console.error('Failed to upload UCAT image for rich text editor:', error)
          const state = editor.state
          state.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (
              node.type.name === PLACEHOLDER_NODE_NAME &&
              node.attrs.id === placeholderId
            ) {
              const tr = state.tr.delete(pos, pos + node.nodeSize)
              editor.view.dispatch(tr)
              return false
            }
            return true
          })
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
    [stemId, maxImagesPerDocument, onImageFileIdsChange]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      if (!editable) return
      if (enableImages === false) return

      event.preventDefault()
      event.stopPropagation()

      const dataTransfer = event.nativeEvent.dataTransfer
      if (!dataTransfer?.files?.length) return

      const files: File[] = Array.from(dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      )
      if (files.length === 0) return

      const editor = editorRef.current?.getEditor()
      if (!editor) return

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
        if ($pos.parent === doc) {
          const before = doc.childBefore(coords.pos)
          const after = doc.childAfter(coords.pos)
          if (!before.node && after.node) {
            insertPos = after.offset
          } else if (before.node && !after.node) {
            insertPos = before.offset + before.node.nodeSize
          } else if (before.node && after.node) {
            const beforeEnd = before.offset + before.node.nodeSize
            const distToBefore = coords.pos - beforeEnd
            const distToAfter = after.offset - coords.pos
            insertPos = distToBefore <= distToAfter ? beforeEnd : after.offset
          }
        } else {
          while ($pos.depth > 0 && !$pos.parent.isBlock) {
            $pos = doc.resolve($pos.before())
          }
          const blockStart = $pos.start()
          const blockEnd = $pos.end()
          const mid = (blockStart + blockEnd) / 2
          insertPos = coords.pos < mid ? blockStart : blockEnd
        }
      }

      await processImagesAtPosition(editor, files, insertPos)
    },
    [editable, enableImages, processImagesAtPosition]
  )

  const handlePasteImages = useCallback(
    (
      editor: Editor,
      files: File[],
      options?: { pastedHtml?: string }
    ) => {
      const insertPos = editor.state.selection.from

      if (options?.pastedHtml) {
        const pastedHtml: string = options.pastedHtml
        void (async () => {
          const signedUrls: string[] = []
          const collectedFileIds: string[] = []
          for (const file of files) {
            try {
              const { fileId, signedUrl } = await uploadUcatImage({
                file,
                stemId,
              })
              collectedFileIds.push(fileId)
              signedUrls.push(signedUrl)
            } catch (error) {
              console.error(
                'Failed to upload UCAT image from pasted HTML:',
                error
              )
              signedUrls.push('')
            }
          }
          let html: string = pastedHtml
          for (let i = 0; i < signedUrls.length; i += 1) {
            if (signedUrls[i]) {
              html = html.replace(`__UPLOAD_${i}__`, signedUrls[i])
            }
          }
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5ab71b'},body:JSON.stringify({sessionId:'5ab71b',location:'UcatRichTextEditor:pastedHtmlInsert',message:'insert pasted html',data:{signedUrlsLen:signedUrls.length,htmlLen:html.length,insertPos,hasPlaceholder:html.includes('__UPLOAD_')},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          editor
            .chain()
            .focus()
            .insertContentAt(insertPos, html as unknown as Parameters<Editor['commands']['insertContentAt']>[1])
            .run()
          if (
            collectedFileIds.length > 0 &&
            typeof onImageFileIdsChange === 'function'
          ) {
            const limited =
              typeof maxImagesPerDocument === 'number' && maxImagesPerDocument > 0
                ? collectedFileIds.slice(-maxImagesPerDocument)
                : collectedFileIds
            onImageFileIdsChange(limited)
          }
        })()
        return
      }

      void processImagesAtPosition(editor, files, insertPos)
    },
    [
      stemId,
      maxImagesPerDocument,
      onImageFileIdsChange,
      processImagesAtPosition,
    ]
  )

  const pasteImagesProp =
    enableImages !== false ? { onPasteImages: handlePasteImages } : {}

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
        {...pasteImagesProp}
      />
    </div>
  )
}

