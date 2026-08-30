'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Input, useToast } from '@altitutor/ui'
import {
  CheckCircle2,
  Eye,
  FileDown,
  FilePenLine,
  ListChecks,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import type { UcatContentStatus, UcatQuestionSetFormat } from '@/features/ucat/shared/types'
import { UcatContentStatusBadge } from '@/features/ucat/shared/components/UcatContentStatusBadge'
import {
  UcatOrderSaveToolbar,
  useUnsavedOrderWarning,
} from '@/features/ucat/shared/components/UcatOrderSaveToolbar'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import {
  UcatSortableList,
  mergeVisibleOrderIntoFull,
} from '@/features/ucat/shared/drag-list'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual'
import {
  buildPublishedSetOrders,
  getSetOrderStatusTransitions,
  setCatalogScopeKey,
  type SetCatalogOrderRow,
} from '@/features/ucat/sets/lib/set-catalog-order'

export type { SetCatalogOrderRow } from '@/features/ucat/sets/lib/set-catalog-order'

type SectionCard = {
  id: string
  name: string
  sectionNumber: number | null
}

type SaveScope = {
  sectionId: string
  setFormat: UcatQuestionSetFormat
  ids: string[]
}

const FORMAT_CARDS: Array<{ value: UcatQuestionSetFormat; label: string }> = [
  { value: 'full_section', label: 'Full sets' },
  { value: 'partial_section', label: 'Partial sets' },
]

function ordersEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every(
    (key) => (a[key] ?? []).join(':') === (b[key] ?? []).join(':'),
  )
}

function paceLabel(row: SetCatalogOrderRow): string {
  const duration = formatSetTimeLimit(row.timeLimitSeconds)
  if (row.timingMode === 'pace' && row.paceMultiplier != null) {
    return `${duration} · ${Number(row.paceMultiplier.toFixed(2))}x pace`
  }
  if (row.timingMode === 'fixed') return `${duration} · fixed`
  return 'Untimed'
}

function stagedDisplayName(
  row: SetCatalogOrderRow,
  index: number | null,
): string {
  const format = row.setFormat === 'full_section' ? 'Full' : 'Partial'
  return index == null
    ? `${row.sectionName} ${format} Set`
    : `${row.sectionName} ${format} Set ${index + 1}`
}

function SetOrderLabel({
  row,
  index,
}: {
  row: SetCatalogOrderRow
  index: number | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div
          className="truncate font-medium"
          title={stagedDisplayName(row, index)}
        >
          {stagedDisplayName(row, index)}
        </div>
        {row.authoringNote ? (
          <div
            className="truncate text-xs text-muted-foreground"
            title={row.authoringNote}
          >
            {row.authoringNote}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <UcatContentStatusBadge status={row.status} />
        <Badge variant="outline" className="text-[10px] font-normal">
          {paceLabel(row)}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {row.questionCount}{' '}
          {row.questionCount === 1 ? 'question' : 'questions'}
        </Badge>
      </div>
    </div>
  )
}

function statusActionIcon(status: UcatContentStatus) {
  if (status === 'published') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'in_review') return <ListChecks className="h-4 w-4" />
  return <FilePenLine className="h-4 w-4" />
}

export function UcatSetCatalogOrderView({
  rows,
  sections,
  onSave,
  onDirtyChange,
  onCreate,
  onView,
  onExportPdf,
  onDelete,
  onStatusChange,
}: {
  rows: SetCatalogOrderRow[]
  sections: SectionCard[]
  onSave: (scopes: SaveScope[]) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onCreate: (sectionId: string, format: UcatQuestionSetFormat) => void
  onView: (setId: string) => void
  onExportPdf: (setId: string) => void
  onDelete: (setId: string) => void
  onStatusChange: (row: SetCatalogOrderRow, status: UcatContentStatus) => void
}) {
  const sourceOrders = useMemo(() => buildPublishedSetOrders(rows), [rows])
  const sourceSignature = useMemo(
    () =>
      Object.entries(sourceOrders)
        .sort()
        .map(([key, ids]) => `${key}=${ids.join(':')}`)
        .join('|'),
    [sourceOrders],
  )
  const previousSourceSignature = useRef<string | null>(null)
  const [baselineOrders, setBaselineOrders] = useState(sourceOrders)
  const [orders, setOrders] = useState(sourceOrders)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (previousSourceSignature.current === sourceSignature) return
    previousSourceSignature.current = sourceSignature
    setBaselineOrders(sourceOrders)
    setOrders(sourceOrders)
  }, [sourceOrders, sourceSignature])

  const dirty = !ordersEqual(orders, baselineOrders)
  useUnsavedOrderWarning(dirty)

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  )
  const query = searchQuery.trim().toLowerCase()
  const orderedSections = useMemo(
    () =>
      [...sections].sort(
        (a, b) => (a.sectionNumber ?? 0) - (b.sectionNumber ?? 0),
      ),
    [sections],
  )

  function matchesSearch(
    row: SetCatalogOrderRow,
    index: number | null,
  ): boolean {
    if (!query) return true
    return [
      stagedDisplayName(row, index),
      row.displayName,
      row.authoringNote ?? '',
      row.status,
    ].some((value) => value.toLowerCase().includes(query))
  }

  function updateScope(
    key: string,
    nextVisibleIds: string[],
    previousVisibleIds: string[],
  ) {
    setOrders((current) => ({
      ...current,
      [key]: mergeVisibleOrderIntoFull(
        current[key] ?? [],
        previousVisibleIds,
        nextVisibleIds,
      ),
    }))
  }

  function actionsFor(
    row: SetCatalogOrderRow,
  ) {
    return (
      <UcatRowActions
        actions={[
          {
            label: 'View',
            icon: <Eye className="h-4 w-4" />,
            onClick: () => onView(row.id),
          },
          ...getSetOrderStatusTransitions(row.status).map((transition) => ({
            label: transition.label,
            icon: statusActionIcon(transition.status),
            onClick: () => onStatusChange(row, transition.status),
          })),
          {
            label: 'Export as PDF',
            icon: <FileDown className="h-4 w-4" />,
            onClick: () => onExportPdf(row.id),
          },
          {
            label: 'Delete',
            icon: <Trash2 className="h-4 w-4" />,
            onClick: () => onDelete(row.id),
            destructive: true,
          },
        ]}
      />
    )
  }

  async function save() {
    const changedScopes = Object.keys(orders)
      .filter(
        (key) =>
          (orders[key] ?? []).join(':') !==
          (baselineOrders[key] ?? []).join(':'),
      )
      .map((key) => {
        const separator = key.lastIndexOf(':')
        return {
          sectionId: key.slice(0, separator),
          setFormat: key.slice(separator + 1) as UcatQuestionSetFormat,
          ids: orders[key] ?? [],
        }
      })
    if (!changedScopes.length) return
    setSaving(true)
    try {
      await onSave(changedScopes)
      setBaselineOrders(orders)
      toast({ title: 'Set order saved' })
    } catch (error) {
      toast({
        title: 'Could not save set order',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search sets…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      {orderedSections.map((section) => (
        <section
          key={section.id}
          className={tutorCardCn('space-y-4 p-5 sm:p-6')}
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {section.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Published sets are numbered independently by format. Unpublished
              sets remain visible at the end.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {FORMAT_CARDS.map((format) => {
              const key = setCatalogScopeKey(section.id, format.value)
              const publishedIds = orders[key] ?? []
              const visiblePublishedIds = publishedIds.filter((id) => {
                const row = rowById.get(id)
                return row
                  ? matchesSearch(row, publishedIds.indexOf(id))
                  : false
              })
              const unpublishedRows = rows
                .filter(
                  (row) =>
                    row.sectionId === section.id &&
                    row.setFormat === format.value &&
                    row.status !== 'published',
                )
                .sort(
                  (a, b) =>
                    a.status.localeCompare(b.status) ||
                    a.displayName.localeCompare(b.displayName),
                )
                .filter((row) => matchesSearch(row, null))

              return (
                <div
                  key={format.value}
                  className={tutorCardCn('flex min-h-56 flex-col gap-4 p-4')}
                >
                  <h3 className="font-semibold">{format.label}</h3>
                  <div className="flex-1 space-y-4">
                    {visiblePublishedIds.length ? (
                      <UcatSortableList
                        ids={visiblePublishedIds}
                        onChange={(ids) =>
                          updateScope(key, ids, visiblePublishedIds)
                        }
                        flatCard
                        renderLabel={(id) => {
                          const row = rowById.get(id)
                          return row ? (
                            <SetOrderLabel
                              row={row}
                              index={publishedIds.indexOf(id)}
                            />
                          ) : (
                            id
                          )
                        }}
                        renderActions={(id) => {
                          const row = rowById.get(id)
                          return row ? actionsFor(row) : null
                        }}
                      />
                    ) : query ? (
                      <p className="text-sm text-muted-foreground">
                        No published sets match your search.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No published sets yet.
                      </p>
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
                          flatCard
                          renderLabel={(id) => {
                            const row = rowById.get(id)
                            return row ? (
                              <SetOrderLabel row={row} index={null} />
                            ) : (
                              id
                            )
                          }}
                          renderActions={(id) => {
                            const row = rowById.get(id)
                            return row ? actionsFor(row) : null
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className={tutorBtnOutline}
                    onClick={() => onCreate(section.id, format.value)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New set
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <UcatOrderSaveToolbar
        isDirty={dirty}
        isSaving={saving}
        onCancel={() => setOrders(baselineOrders)}
        onSave={() => void save()}
      />
    </div>
  )
}
