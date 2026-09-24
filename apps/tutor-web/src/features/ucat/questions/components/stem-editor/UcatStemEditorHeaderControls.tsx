'use client'

import { SegmentedControl } from '@/shared/components/segmented-control'
import type { StemEditorMode } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'

type HeaderMode = StemEditorMode | 'show_answer'

export function UcatStemEditorHeaderControls({
  mode,
  onModeChange,
  showAnswer,
  onShowAnswerChange,
}: {
  mode: StemEditorMode
  onModeChange: (mode: StemEditorMode) => void
  showAnswer: boolean
  onShowAnswerChange: (show: boolean) => void
}) {
  const value: HeaderMode = mode === 'view' && showAnswer ? 'show_answer' : mode

  function handleValueChange(next: HeaderMode) {
    if (next === 'edit') {
      onShowAnswerChange(false)
      onModeChange('edit')
      return
    }
    onModeChange('view')
    onShowAnswerChange(next === 'show_answer')
  }

  return (
    <SegmentedControl
      value={value}
      onValueChange={handleValueChange}
      options={[
        { value: 'edit', label: 'Edit' },
        { value: 'view', label: 'View' },
        { value: 'show_answer', label: 'Show answer' },
      ]}
    />
  )
}
