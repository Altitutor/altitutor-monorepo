'use client'

import { useMemo } from 'react'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'

export function UcatMockSetMembershipCard({
  setIds,
  setCatalog,
  onViewSet,
}: {
  setIds: string[]
  setCatalog: SetOption[]
  onViewSet?: (setId: string) => void
}) {
  const linkedSets = useMemo(() => {
    const byId = new Map(setCatalog.map((set) => [set.id, set]))
    return setIds
      .map((id) => byId.get(id))
      .filter((set): set is SetOption => set != null)
  }, [setIds, setCatalog])

  if (linkedSets.length === 0) {
    return <p className="text-xs text-muted-foreground">No sets in this mock yet.</p>
  }

  return (
    <ul className="space-y-1">
      {linkedSets.map((set) => (
        <li key={set.id}>
          {onViewSet ? (
            <button
              type="button"
              className="w-full truncate rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/60"
              onClick={() => onViewSet(set.id)}
            >
              {set.name}
            </button>
          ) : (
            <p className="truncate px-2 py-1.5 text-sm font-medium">{set.name}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
