'use client'

import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { Json } from '@altitutor/shared'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type StaffSetOption = {
  id: string
  name: string
}

export function UcatStemSetMembershipCard({
  stemId,
  highlighted = false,
}: {
  stemId: string | null | undefined
  highlighted?: boolean
}) {
  const setsQuery = useUcatSets()
  const [viewingSetId, setViewingSetId] = useState<string | null>(null)

  const staffSets = useMemo(
    () =>
      (setsQuery.data ?? [])
        .filter((set) => set.id && !set.deleted_at)
        .map((set) => ({
          id: set.id as string,
          name: proseMirrorToPlainText(set.name as Json | undefined) || 'Untitled',
        })),
    [setsQuery.data],
  )

  const setDetailQueries = useQueries({
    queries: staffSets.map((set) => ({
      queryKey: ucatKeys.set(set.id),
      queryFn: () => ucatSetsApi.detail(set.id),
      enabled: !!stemId,
    })),
  })

  const currentSets = useMemo((): StaffSetOption[] => {
    if (!stemId) return []
    return staffSets.filter((_, index) => {
      const detail = setDetailQueries[index]?.data
      const stems = (detail?.stems as Array<{ stem_id: string }> | null) ?? []
      return stems.some((stem) => stem.stem_id === stemId)
    })
  }, [staffSets, setDetailQueries, stemId])

  if (!stemId) return null

  const isLoading = setsQuery.isLoading || setDetailQueries.some((query) => query.isLoading)

  return (
    <>
      {highlighted ? (
        <p className="text-xs text-amber-900 dark:text-amber-100">
          Check whether this private stem is already in a staff-authored set.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading set membership...</p>
      ) : currentSets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not in any staff-authored set.</p>
      ) : (
        <ul className="space-y-1">
          {currentSets.map((set) => (
            <li key={set.id}>
              <button
                type="button"
                className="w-full truncate rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/60"
                onClick={() => setViewingSetId(set.id)}
              >
                {set.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <UcatSetEditorDialog
        open={!!viewingSetId}
        setId={viewingSetId}
        onClose={() => setViewingSetId(null)}
      />
    </>
  )
}
