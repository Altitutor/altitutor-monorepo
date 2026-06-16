'use client'

import type { Editor } from '@tiptap/react'
import { RichTextEditorBottomToolbar } from '@altitutor/ui'

type UcatRichTextToolbarProps = {
  editor: Editor | null
}

/** Borderless compact toolbar for tutor-web dialog footers and floating editors. */
export function UcatRichTextToolbar({ editor }: UcatRichTextToolbarProps) {
  if (!editor) return null
  return <RichTextEditorBottomToolbar editor={editor} variant="plain" />
}
