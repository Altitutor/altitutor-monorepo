import type { UcatContentStatus } from '@/features/ucat/shared/types'

export type MockCatalogOrderRow = {
  id: string
  displayName: string
  authoringNote: string | null
  catalogIndex: number | null
  status: UcatContentStatus
}

export function belongsInMockCatalogOrder(mock: {
  deletedAt?: string | null
}): boolean {
  return mock.deletedAt == null
}

export function buildPublishedMockOrder(rows: MockCatalogOrderRow[]): string[] {
  return rows
    .filter((row) => row.status === 'published')
    .sort((a, b) =>
      (a.catalogIndex ?? Number.MAX_SAFE_INTEGER) -
        (b.catalogIndex ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
    )
    .map((row) => row.id)
}

export function unpublishedMockOrderRows(
  rows: MockCatalogOrderRow[],
): MockCatalogOrderRow[] {
  return rows
    .filter((row) => row.status !== 'published')
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) ||
        a.displayName.localeCompare(b.displayName),
    )
}
