import { useCallback, useMemo, useState } from 'react'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

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
  setStems: (stems: UcatQuestionStemFormValues[]) => void
  selectStem: (index: number) => void
  goToNextStem: () => void
  goToPreviousStem: () => void
  updateStemForm: (stemId: string, values: UcatQuestionStemFormValues) => void
  reset: () => void
}

export function useBulkImportWizard(): BulkImportWizardApi {
  const [stems, setStemsInternal] = useState<BulkImportStemDraft[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const setStems = useCallback((values: UcatQuestionStemFormValues[]) => {
    setStemsInternal(
      values.map((v, index) => ({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `stem-${index + 1}`,
        values: v,
      }))
    )
    setActiveIndex(0)
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
    setStemsInternal((prev) =>
      prev.map((stem) => (stem.id === stemId ? { ...stem, values } : stem))
    )
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

