'use client'

import { RichTextEditor } from '@altitutor/ui'
import { UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { InstructionsScreen } from '@/features/question-engine/model/types'

export function InstructionsContent({ screen }: { screen: InstructionsScreen }) {
  const content = screen.instructionsJson ?? { type: 'doc', content: [{ type: 'paragraph' }] }
  return (
    <div
      className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
      data-testid="instructions-content"
    >
      <div className="py-4 sm:py-5">
        <RichTextEditor
          content={content}
          editable={false}
          minHeight="auto"
          className="min-h-0 [&_.ProseMirror]:min-h-[200px]"
        />
      </div>
    </div>
  )
}
