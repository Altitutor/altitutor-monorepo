import { act, renderHook } from '@testing-library/react'
import { useBulkImportDecisions } from '@/features/ucat/questions/hooks/useBulkImportDecisions'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'

const STEM_READY = '20000000-0000-4000-8000-000000000001'
const STEM_INCOMPLETE = '20000000-0000-4000-8000-000000000002'

const stems = [STEM_READY, STEM_INCOMPLETE].map((id) => ({
  id,
  values: {
    sectionId: '10000000-0000-4000-8000-000000000001',
    categoryId: null,
    stemText: { type: 'doc', content: [] },
    accessScope: 'public' as const,
    questions: [],
  },
})) satisfies BulkImportStemDraft[]

describe('useBulkImportDecisions', () => {
  it('defaults by readiness, then advisory-excludes duplicate stems', () => {
    const { result, rerender } = renderHook(
      ({ duplicates }: { duplicates: ReadonlySet<string> }) => useBulkImportDecisions({
        stems,
        readinessByStemId: {
          [STEM_READY]: { eligibleForInReview: true },
          [STEM_INCOMPLETE]: { eligibleForInReview: false },
        },
        defaultExcludedStemIds: duplicates,
      }),
      { initialProps: { duplicates: new Set<string>() } },
    )

    expect(result.current.decisions).toEqual({
      [STEM_READY]: 'in_review',
      [STEM_INCOMPLETE]: 'draft',
    })

    rerender({ duplicates: new Set([STEM_READY]) })
    expect(result.current.decisions[STEM_READY]).toBe('exclude')
    expect(result.current.selectedStems.map((stem) => stem.id)).toEqual([STEM_INCOMPLETE])
  })

  it('keeps a tutor override after a duplicate warning appears', () => {
    const duplicateIds = new Set([STEM_READY])
    const { result, rerender } = renderHook(() => useBulkImportDecisions({
      stems,
      readinessByStemId: {
        [STEM_READY]: { eligibleForInReview: true },
        [STEM_INCOMPLETE]: { eligibleForInReview: false },
      },
      defaultExcludedStemIds: duplicateIds,
    }))

    expect(result.current.decisions[STEM_READY]).toBe('exclude')
    act(() => result.current.setDecision(STEM_READY, 'in_review'))
    rerender()
    expect(result.current.decisions[STEM_READY]).toBe('in_review')
  })

  it('never keeps In review selected after readiness fails', () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useBulkImportDecisions({
        stems: [stems[0]],
        readinessByStemId: { [STEM_READY]: { eligibleForInReview: ready } },
      }),
      { initialProps: { ready: true } },
    )
    act(() => result.current.setDecision(STEM_READY, 'in_review'))
    rerender({ ready: false })
    expect(result.current.decisions[STEM_READY]).toBe('draft')
  })
})
