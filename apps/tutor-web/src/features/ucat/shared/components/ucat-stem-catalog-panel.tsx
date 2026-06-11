'use client'

import { useMemo } from 'react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { Badge, Button, getUcatVisibilityColor, ListToolbar } from '@altitutor/ui'
import { Pencil, Plus } from 'lucide-react'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { filterStemCatalogItems } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'
import { EXPANDABLE_DIALOG_TRANSITION } from '@/shared/components/expandable-dialog'

export function UcatStemCatalogRow({
  stem,
  onAdd,
  onEdit,
}: {
  stem: UcatStemCatalogItem
  onAdd: () => void
  onEdit?: () => void
}) {
  return (
    <div className="flex w-full items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem.text || stem.id}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>
            {stem.sectionNumber}. {stem.sectionName}
          </span>
          <Badge
            variant="outline"
            className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
          >
            {stem.isPrivate ? 'Private' : 'Public'}
          </Badge>
          <span>
            · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="default"
          size="icon"
          className={cn(tutorBtnPrimary, 'shrink-0')}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function UcatStemCatalogLabel({
  stem,
  id,
  index,
}: {
  stem: UcatStemCatalogItem | undefined
  id: string
  index: number
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem?.text || id}</div>
        {stem ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>
              {stem.sectionNumber}. {stem.sectionName}
            </span>
            <Badge
              variant="outline"
              className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
            >
              {stem.isPrivate ? 'Private' : 'Public'}
            </Badge>
            <span>
              · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type UcatStemCatalogAddPanelProps = {
  stems: UcatStemCatalogItem[]
  excludedIds: string[]
  search: string
  onSearchChange: (value: string) => void
  filters: Record<string, unknown[]>
  onFiltersChange: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  onAddStem: (stemId: string) => void
  onEditStem?: (stemId: string) => void
  title?: string
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
}

export function UcatStemCatalogAddPanel({
  stems,
  excludedIds,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filterDefinitions,
  onAddStem,
  onEditStem,
  title = 'Add stems',
  emptyMessage = 'No stems to add, or all matching stems are already selected.',
  searchPlaceholder = 'Search stems',
  className,
}: UcatStemCatalogAddPanelProps) {
  const availableStems = useMemo(
    () =>
      filterStemCatalogItems({
        stems,
        excludedIds,
        search,
        filters,
      }),
    [stems, excludedIds, search, filters]
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-hidden', className)}>
      <h2 className="font-semibold">{title}</h2>
      <ListToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        filterDefinitions={filterDefinitions}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {availableStems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          availableStems.map((stem) => (
            <UcatStemCatalogRow
              key={stem.id}
              stem={stem}
              onAdd={() => onAddStem(stem.id)}
              onEdit={onEditStem ? () => onEditStem(stem.id) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function UcatStemCatalogSidePanel({
  open,
  children,
  className,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-l',
        EXPANDABLE_DIALOG_TRANSITION,
        open ? 'w-96 opacity-100' : 'pointer-events-none w-0 border-l-0 opacity-0',
        className
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full w-96 flex-col overflow-hidden p-6">{children}</div>
    </aside>
  )
}
