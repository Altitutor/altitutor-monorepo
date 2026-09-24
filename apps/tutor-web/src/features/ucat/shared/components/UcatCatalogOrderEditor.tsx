'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@altitutor/ui'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import {
  UcatOrderSaveToolbar,
  useUnsavedOrderWarning,
} from '@/features/ucat/shared/components/UcatOrderSaveToolbar'

type CatalogOrderRow = {
  id: string
  displayName: string
  authoringNote?: string | null
}

export function UcatCatalogOrderEditor({
  rows,
  unpublishedRows = [],
  onSave,
  onDirtyChange,
}: {
  rows: CatalogOrderRow[]
  unpublishedRows?: CatalogOrderRow[]
  onSave: (ids: string[]) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}) {
  const sourceIds = useMemo(() => rows.map((row) => row.id), [rows])
  const sourceSignature = sourceIds.join(':')
  const [baselineIds, setBaselineIds] = useState(sourceIds)
  const [orderedIds, setOrderedIds] = useState(sourceIds)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setBaselineIds(sourceIds)
    setOrderedIds(sourceIds)
  }, [sourceIds, sourceSignature])

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const dirty = orderedIds.join(':') !== baselineIds.join(':')

  useUnsavedOrderWarning(dirty)

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  async function save() {
    setSaving(true)
    try {
      await onSave(orderedIds)
      setBaselineIds(orderedIds)
    } catch (error) {
      toast({
        title: 'Could not save display order',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={tutorCardCn('space-y-4 p-4 pb-24')}>
      <div>
        <h2 className="font-semibold">Display order</h2>
        <p className="text-sm text-muted-foreground">
          Published mocks are numbered globally. Unpublished mocks remain visible
          at the end.
        </p>
      </div>
      {orderedIds.length ? (
        <UcatSortableList
          ids={orderedIds}
          onChange={setOrderedIds}
          renderLabel={(id, index) => {
            const row = rowById.get(id)
            return (
              <div>
                <div className="font-medium">{index + 1}. {row?.displayName ?? id}</div>
                {row?.authoringNote ? <div className="text-xs text-muted-foreground">{row.authoringNote}</div> : null}
              </div>
            )
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No published mocks yet.</p>
      )}
      {unpublishedRows.length ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unpublished
          </p>
          <UcatSortableList
            ids={unpublishedRows.map((row) => row.id)}
            onChange={() => undefined}
            disableReorder
            renderLabel={(id) => {
              const row = unpublishedRows.find((item) => item.id === id)
              return (
                <div>
                  <div className="font-medium">{row?.displayName ?? id}</div>
                  {row?.authoringNote ? (
                    <div className="text-xs text-muted-foreground">{row.authoringNote}</div>
                  ) : null}
                </div>
              )
            }}
          />
        </div>
      ) : null}
      <UcatOrderSaveToolbar
        isDirty={dirty}
        isSaving={saving}
        onCancel={() => setOrderedIds(baselineIds)}
        onSave={() => void save()}
      />
    </div>
  )
}
