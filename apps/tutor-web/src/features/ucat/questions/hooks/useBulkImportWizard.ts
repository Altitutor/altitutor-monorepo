import { useCallback, useMemo, useState } from 'react'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { normalizeAuthoredQuestionContract } from '@/features/ucat/questions/lib/response-contract-authoring'

export type BulkImportStemDraft = {
  id: string
  values: UcatQuestionStemFormValues
}

export type BulkImportWizardState = {
  stems: BulkImportStemDraft[]
  activeIndex: number
}

export type BulkImportWizardApi = {
  state: BulkImportWizardState
  setStems: (stems: UcatQuestionStemFormValues[]) => BulkImportStemDraft[]
  selectStem: (index: number) => void
  goToNextStem: () => void
  goToPreviousStem: () => void
  updateStemForm: (stemId: string, values: UcatQuestionStemFormValues) => void
  reset: () => void
}

function draftUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (character) => {
    const random = Math.floor(Math.random() * 16)
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

export function useBulkImportWizard(): BulkImportWizardApi {
  const [stems, setStemsInternal] = useState<BulkImportStemDraft[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const setStems = useCallback((values: UcatQuestionStemFormValues[]): BulkImportStemDraft[] => {
    const drafts: BulkImportStemDraft[] = values.map((value) => {
      const stemId = draftUuid()
      return {
        id: stemId,
        values: {
          ...value,
          questions: value.questions.map((rawQuestion) => {
            const question = normalizeAuthoredQuestionContract(rawQuestion)
            return {
            ...question,
            id:
              question.id
              ?? draftUuid(),
            options: question.options.map((option) => ({
              ...option,
              id:
                option.id
                ?? draftUuid(),
            })),
            }
          }),
        },
      }
    })
    setStemsInternal(drafts)
    setActiveIndex(0)
    return drafts
  }, [])

  const selectStem = useCallback((index: number) => {
    setActiveIndex(() => {
      if (stems.length === 0) return 0
      if (index < 0) return 0
      if (index >= stems.length) return stems.length - 1
      return index
    })
  }, [stems.length])

  const goToNextStem = useCallback(() => {
    setActiveIndex((prev) => {
      if (stems.length === 0) return 0
      return Math.min(prev + 1, stems.length - 1)
    })
  }, [stems.length])

  const goToPreviousStem = useCallback(() => {
    setActiveIndex((prev) => {
      if (stems.length === 0) return 0
      return Math.max(prev - 1, 0)
    })
  }, [stems.length])

  const updateStemForm = useCallback((stemId: string, values: UcatQuestionStemFormValues) => {
    setStemsInternal((prev) => {
      const existing = prev.find((stem) => stem.id === stemId)
      if (!existing) return prev
      if (existing.values === values) return prev
      try {
        if (JSON.stringify(existing.values) === JSON.stringify(values)) return prev
      } catch {
        // Fall through to update if values are not serializable for comparison.
      }
      return prev.map((stem) => (stem.id === stemId ? { ...stem, values } : stem))
    })
  }, [])

  const reset = useCallback(() => {
    setStemsInternal([])
    setActiveIndex(0)
  }, [])

  const state = useMemo(
    () => ({
      stems,
      activeIndex,
    }),
    [stems, activeIndex]
  )

  return {
    state,
    setStems,
    selectStem,
    goToNextStem,
    goToPreviousStem,
    updateStemForm,
    reset,
  }
}
