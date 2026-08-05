import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'

export type BulkImportDecision = 'in_review' | 'draft' | 'exclude'

export type BulkImportReadiness = {
  eligibleForInReview: boolean
}

export function useBulkImportDecisions(params: {
  stems: BulkImportStemDraft[]
  readinessByStemId: Record<string, BulkImportReadiness>
  defaultExcludedStemIds?: ReadonlySet<string>
}) {
  const [decisions, setDecisions] = useState<Record<string, BulkImportDecision>>({})
  const explicitStemIdsRef = useRef<Set<string>>(new Set())
  const duplicateDefaultStemIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const stemIds = new Set(params.stems.map((stem) => stem.id))
    setDecisions((current) => {
      const next: Record<string, BulkImportDecision> = {}
      for (const stem of params.stems) {
        const eligible = params.readinessByStemId[stem.id]?.eligibleForInReview === true
        const existing = current[stem.id]
        const duplicateDefault = params.defaultExcludedStemIds?.has(stem.id) === true
        const explicitlyChosen = explicitStemIdsRef.current.has(stem.id)
        if (duplicateDefault && !explicitlyChosen) {
          next[stem.id] = 'exclude'
          duplicateDefaultStemIdsRef.current.add(stem.id)
          continue
        }
        if (!duplicateDefault && duplicateDefaultStemIdsRef.current.delete(stem.id) && !explicitlyChosen) {
          next[stem.id] = eligible ? 'in_review' : 'draft'
          continue
        }
        if (!existing) {
          next[stem.id] = eligible ? 'in_review' : 'draft'
        } else if (existing === 'in_review' && !eligible) {
          next[stem.id] = 'draft'
        } else if (existing === 'draft' && eligible && !explicitlyChosen) {
          next[stem.id] = 'in_review'
        } else {
          next[stem.id] = existing
        }
      }
      const currentIds = Object.keys(current)
      const nextIds = Object.keys(next)
      return currentIds.length === nextIds.length
        && nextIds.every((id) => current[id] === next[id])
        ? current
        : next
    })
    explicitStemIdsRef.current = new Set([...explicitStemIdsRef.current].filter((id) => stemIds.has(id)))
  }, [params.defaultExcludedStemIds, params.readinessByStemId, params.stems])

  const setDecision = useCallback((stemId: string, decision: BulkImportDecision) => {
    explicitStemIdsRef.current.add(stemId)
    duplicateDefaultStemIdsRef.current.delete(stemId)
    setDecisions((current) => ({ ...current, [stemId]: decision }))
  }, [])

  const setAll = useCallback((decision: BulkImportDecision) => {
    const next: Record<string, BulkImportDecision> = {}
    const explicit = new Set<string>()
    for (const stem of params.stems) {
      const eligible = params.readinessByStemId[stem.id]?.eligibleForInReview === true
      next[stem.id] = decision === 'in_review' && !eligible ? 'draft' : decision
      explicit.add(stem.id)
    }
    explicitStemIdsRef.current = explicit
    setDecisions(next)
  }, [params.readinessByStemId, params.stems])

  const selectedStems = useMemo(() => params.stems.flatMap((stem) => {
    const decision = decisions[stem.id]
      ?? (params.readinessByStemId[stem.id]?.eligibleForInReview ? 'in_review' : 'draft')
    return decision === 'exclude' ? [] : [{ ...stem, importStatus: decision }]
  }), [decisions, params.readinessByStemId, params.stems])

  const reset = useCallback(() => {
    setDecisions({})
    explicitStemIdsRef.current = new Set()
    duplicateDefaultStemIdsRef.current = new Set()
  }, [])

  return { decisions, setDecision, setAll, selectedStems, reset }
}
