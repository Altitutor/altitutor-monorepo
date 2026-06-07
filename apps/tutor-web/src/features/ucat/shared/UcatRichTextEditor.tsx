import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/shared/utils'
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
import {
  createUcatParseHighlight,
  UCAT_PARSE_DECO_META,
  type UcatParseHighlightConfig,
} from '@/features/ucat/shared/ucatParseHighlightPlugin'

/** TipTap reads `text-foreground`; pin dark body text on white UCAT engine shells when app theme is dark. */
const UCAT_RTE_FORCE_LIGHT_CHROME_CLASSNAME =
  '[&_.tiptap]:!text-neutral-950 [&_.tiptap]:dark:!text-neutral-950 [&_.tiptap_.ProseMirror]:!text-neutral-950 [&_.tiptap_.ProseMirror]:dark:!text-neutral-950 [&_.tiptap_.ProseMirror_li]:marker:!text-neutral-600 [&_.tiptap_.ProseMirror_li]:marker:dark:!text-neutral-600 [&_p.is-empty.is-editor-empty:first-child:before]:!text-neutral-400'

/**
 * Table borders on the TipTap root (className is merged onto view.dom / `.tiptap.ProseMirror`).
 * Use `[&_table]` — not `[&_.ProseMirror_table]`, which requires a nested editor node.
 */
export const UCAT_ENGINE_TABLE_ROOT_CLASSNAME =
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-solid [&_table]:!border-[#9ba9bd] [&_th]:border [&_th]:border-solid [&_th]:!border-[#9ba9bd] [&_th]:bg-[#f3f4f6] [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-solid [&_td]:!border-[#9ba9bd] [&_td]:p-2 [&_td]:align-top'

/**
 * Table borders when styles live on a wrapper around RichTextEditor (inline edit chrome).
 */
export const UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME =
  '[&_.tiptap_table]:my-2 [&_.tiptap_table]:w-full [&_.tiptap_table]:border-collapse [&_.tiptap_table]:border [&_.tiptap_table]:border-solid [&_.tiptap_table]:!border-[#9ba9bd] [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-solid [&_.ProseMirror_table]:!border-[#9ba9bd] [&_.tiptap_th]:border [&_.tiptap_th]:border-solid [&_.tiptap_th]:!border-[#9ba9bd] [&_.tiptap_th]:bg-[#f3f4f6] [&_.tiptap_th]:p-2 [&_.tiptap_th]:text-left [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-solid [&_.ProseMirror_th]:!border-[#9ba9bd] [&_.ProseMirror_th]:bg-[#f3f4f6] [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.tiptap_td]:border [&_.tiptap_td]:border-solid [&_.tiptap_td]:!border-[#9ba9bd] [&_.tiptap_td]:p-2 [&_.tiptap_td]:align-top [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-solid [&_.ProseMirror_td]:!border-[#9ba9bd] [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top'

/** @deprecated Use UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME or UCAT_ENGINE_TABLE_ROOT_CLASSNAME */
export const UCAT_ENGINE_TABLE_CLASSNAME = UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME

/** Read-only rich text on white UCAT engine shells (view mode / previews). */
export const UCAT_ENGINE_READONLY_EDITOR_CLASSNAME = cn(
  'h-auto min-h-0 text-black',
  '[&]:min-h-0 [&]:p-0 [&]:pl-0',
  UCAT_RTE_FORCE_LIGHT_CHROME_CLASSNAME,
  UCAT_ENGINE_TABLE_ROOT_CLASSNAME,
  '[&_strong]:font-bold [&_b]:font-bold',
  '[&_em]:italic',
  '[&_p]:my-1'
)

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
  /** When true, pasting plain text with newlines inserts one paragraph per line (e.g. for bulk import). */
  pastePlainTextAsParagraphs?: boolean
  /** When set, controls how pasted table content is handled. See RichTextEditor pasteTableBehavior. */
  pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep'
  /** When true, pasted HTML keeps only bold, italic, and tables. See RichTextEditor pasteStripFormatting. */
  pasteStripFormatting?: boolean
  /**
   * Bulk import: in-editor parse highlights. Defaults to `mode: 'off'`. Read from a ref internally;
   * dispatch a no-op tr with {@link UCAT_PARSE_DECO_META} when this changes without a doc change.
   */
  ucatParseHighlight?: UcatParseHighlightConfig
  /** Merged with the optional UCAT parse-highlight extension (when enabled). */
  additionalExtensions?: import('@tiptap/core').AnyExtension[]
  /** Fires when the TipTap editor is ready; runs after internal UCAT parse-highlight meta refresh. */
  onEditorReady?: (editor: Editor) => void
  /**
   * When true, skips Typography `prose` (matches parse-highlight mode) and pins editor text to a dark
   * neutral palette so content stays readable on white UCAT engine chrome while the app is in dark mode.
   */
  forceLightChrome?: boolean
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
  pastePlainTextAsParagraphs,
  pasteTableBehavior,
  pasteStripFormatting,
  ucatParseHighlight: ucatParseHighlightProp,
  additionalExtensions,
  onEditorReady: onEditorReadyProp,
  forceLightChrome = false,
}: UcatRichTextEditorProps) {
  const editorRef = useRef<RichTextEditorRef | null>(null)
  const ucatParseHighlight = useMemo<UcatParseHighlightConfig>(
    () => ucatParseHighlightProp ?? { mode: 'off' as const },
    [ucatParseHighlightProp]
  )
  const ucatParseCfgRef = useRef<UcatParseHighlightConfig>(ucatParseHighlight)
  ucatParseCfgRef.current = ucatParseHighlight
  const ucatParseExt = useMemo(
    () => createUcatParseHighlight(() => ucatParseCfgRef.current),
    []
  )
  const mergedExtraExtensions = useMemo(
    () => [ucatParseExt, ...(additionalExtensions ?? [])],
    [additionalExtensions, ucatParseExt]
  )
  useEffect(() => {
    if (ucatParseHighlightProp == null) return
    const ed = editorRef.current?.getEditor()
    if (!ed) return
    ed.view.dispatch(ed.state.tr.setMeta(UCAT_PARSE_DECO_META, 1))
  }, [ucatParseHighlightProp])

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
            const url = signedUrls[i]
            const fileId = collectedFileIds[i]
            if (!url || !fileId) continue
            const placeholder = `__UPLOAD_${i}__`
            html = html.replace(
              new RegExp(
                `(<img\\b[^>]*\\bsrc\\s*=\\s*["'])${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`,
                'gi'
              ),
              `$1${url}$2 data-file-id="${fileId}"`
            )
          }
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

  const omitTypography =
    forceLightChrome || ucatParseHighlight.mode !== 'off'

  return (
    <div
      className={cn(
        className,
        forceLightChrome && UCAT_RTE_FORCE_LIGHT_CHROME_CLASSNAME,
        forceLightChrome && UCAT_ENGINE_TABLE_WRAPPER_CLASSNAME
      )}
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
        pastePlainTextAsParagraphs={pastePlainTextAsParagraphs}
        pasteTableBehavior={pasteTableBehavior}
        pasteStripFormatting={pasteStripFormatting}
        extensions={mergedExtraExtensions}
        omitTypography={omitTypography}
        onEditorReady={(ed) => {
          if (ucatParseHighlightProp != null) {
            ed.view.dispatch(ed.state.tr.setMeta(UCAT_PARSE_DECO_META, 1))
          }
          onEditorReadyProp?.(ed)
        }}
        {...pasteImagesProp}
      />
    </div>
  )
}

