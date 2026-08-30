import type {
  UcatContentStatus,
  UcatQuestionSetFormat,
} from '@/features/ucat/shared/types'

export type SetCatalogOrderRow = {
  id: string
  displayName: string
  authoringNote: string | null
  sectionId: string
  sectionName: string
  sectionNumber: number | null
  setFormat: UcatQuestionSetFormat
  catalogIndex: number | null
  status: UcatContentStatus
  timingMode: 'pace' | 'fixed' | 'untimed'
  paceMultiplier: number | null
  timeLimitSeconds: number | null
  questionCount: number
}

export function setCatalogScopeKey(
  sectionId: string,
  format: UcatQuestionSetFormat,
): string {
  return `${sectionId}:${format}`
}

export function buildPublishedSetOrders(
  rows: SetCatalogOrderRow[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const row of rows) {
    if (row.status !== 'published') continue
    const key = setCatalogScopeKey(row.sectionId, row.setFormat)
    result[key] = result[key] ?? []
    result[key].push(row.id)
  }
  const rowById = new Map(rows.map((row) => [row.id, row]))
  for (const ids of Object.values(result)) {
    ids.sort((a, b) => {
      const rowA = rowById.get(a)
      const rowB = rowById.get(b)
      return (
        (rowA?.catalogIndex ?? Number.MAX_SAFE_INTEGER) -
          (rowB?.catalogIndex ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b)
      )
    })
  }
  return result
}

export function getSetOrderStatusTransitions(
  status: UcatContentStatus,
): Array<{ status: UcatContentStatus; label: string }> {
  if (status === 'draft') {
    return [{ status: 'in_review', label: 'Move to in review' }]
  }
  if (status === 'in_review') {
    return [
      { status: 'published', label: 'Publish' },
      { status: 'draft', label: 'Move to draft' },
    ]
  }
  return [
    { status: 'in_review', label: 'Move to in review' },
    { status: 'draft', label: 'Move to draft' },
  ]
}
