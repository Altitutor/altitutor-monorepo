'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, useToast } from '@altitutor/ui'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { tutorBtnOutline, tutorBtnPrimary, tutorCardCn } from '@/shared/lib/tutor-visual'

type CatalogOrderRow = {
  id: string
  displayName: string
  authoringNote?: string | null
}

export function UcatCatalogOrderEditor({
  rows,
  onSave,
}: {
  rows: CatalogOrderRow[]
  onSave: (ids: string[]) => Promise<void>
}) {
  const sourceIds = useMemo(() => rows.map((row) => row.id), [rows])
  const sourceSignature = sourceIds.join(':')
  const [orderedIds, setOrderedIds] = useState(sourceIds)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => setOrderedIds(sourceIds), [sourceIds, sourceSignature])

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const dirty = orderedIds.join(':') !== sourceSignature

  async function save() {
    setSaving(true)
    try {
      await onSave(orderedIds)
      toast({ title: 'Display order saved' })
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
    <div className={tutorCardCn('space-y-4 p-4')}>
      <div>
        <h2 className="font-semibold">Display order</h2>
        <p className="text-sm text-muted-foreground">
          Drag rows, use the keyboard drag handle, or use the arrow buttons. Saving renumbers the catalog contiguously.
        </p>
      </div>
      {orderedIds.length ? (
        <UcatSortableList
          ids={orderedIds}
          onChange={setOrderedIds}
          showMoveButtons
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
        <p className="text-sm text-muted-foreground">Nothing is available in this ordering scope.</p>
      )}
      <div className="flex justify-end gap-2">
        <Button className={tutorBtnOutline} variant="outline" disabled={!dirty || saving} onClick={() => setOrderedIds(sourceIds)}>
          Cancel
        </Button>
        <Button className={tutorBtnPrimary} disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save order'}
        </Button>
      </div>
    </div>
  )
}
