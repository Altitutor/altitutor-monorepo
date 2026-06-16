'use client'

import type { Editor } from '@tiptap/react'
import { UcatRichTextToolbar } from '@/features/ucat/shared/components/UcatRichTextToolbar'

type UcatRichTextFloatingToolbarProps = {
  editor: Editor | null
}

/** Floating rich-text toolbar (matches admin-web daily notes editor layout, plain chrome). */
export function UcatRichTextFloatingToolbar({ editor }: UcatRichTextFloatingToolbarProps) {
  if (!editor) return null

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto min-w-0 max-w-full" data-rich-text-toolbar>
        <UcatRichTextToolbar editor={editor} />
      </div>
    </div>
  )
}
