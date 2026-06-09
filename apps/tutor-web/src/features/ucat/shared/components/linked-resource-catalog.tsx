'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  ListToolbar,
  SearchableSelect,
  Skeleton,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil } from 'lucide-react'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline } from '@/shared/lib/tutor-visual'
import { applyCoreStringFilter } from '@/features/ucat/shared/hooks/useUcatTableState'

export type LinkedResourceCatalogItem = {
  id: string
  title: string
  subtitle?: string
  sectionName?: string
  meta?: React.ReactNode
}

type SortOption = 'default' | 'section' | 'title'

type LinkedResourceCatalogProps = {
  items: LinkedResourceCatalogItem[]
  isLoading?: boolean
  emptyMessage: string
  searchPlaceholder: string
  sectionOptions?: Array<{ id: string; name: string }>
  onItemClick: (id: string) => void
}

function SortableCatalogCard({
  item,
  onItemClick,
}: {
  item: LinkedResourceCatalogItem
  onItemClick: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded border border-border px-2 py-2 text-left text-sm bg-background',
        isDragging && 'opacity-50'
      )}
    >
      <button
        type="button"
        className="mt-0.5 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 active:cursor-grabbing"
        aria-label={`Reorder ${item.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onItemClick(item.id)}
        className="flex min-w-0 flex-1 items-start gap-2 text-left hover:opacity-90"
      >
        <div className="min-w-0">
          <div className="line-clamp-2 break-words text-xs sm:text-sm">{item.title}</div>
          {(item.subtitle || item.sectionName || item.meta) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {item.sectionName ? <span>{item.sectionName}</span> : null}
              {item.subtitle ? <span>{item.subtitle}</span> : null}
              {item.meta}
            </div>
          )}
        </div>
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(tutorBtnIconOutline, 'shrink-0 text-muted-foreground hover:text-foreground')}
        onClick={() => onItemClick(item.id)}
        aria-label={`Open ${item.title}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function LinkedResourceCatalog({
  items,
  isLoading = false,
  emptyMessage,
  searchPlaceholder,
  sectionOptions = [],
  onItemClick,
}: LinkedResourceCatalogProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [orderedIds, setOrderedIds] = useState<string[]>([])

  const filterDefinitions = useMemo<DataTableFilterDefinition[]>(() => {
    if (!sectionOptions.length) return []
    return [
      {
        key: 'section',
        label: 'Section',
        type: 'multi-select',
        options: sectionOptions.map((section) => ({
          label: section.name,
          value: section.name,
        })),
      },
    ]
  }, [sectionOptions])

  const filteredItems = useMemo(() => {
    const sectionFilter = (filters.section ?? []) as string[]
    let result = items.filter((item) => {
      const searchHit =
        !search.trim() ||
        applyCoreStringFilter(item.title, search) ||
        applyCoreStringFilter(item.subtitle ?? '', search) ||
        applyCoreStringFilter(item.sectionName ?? '', search)
      const sectionHit =
        sectionFilter.length === 0 ||
        (item.sectionName != null && sectionFilter.includes(item.sectionName))
      return searchHit && sectionHit
    })

    if (sortBy === 'section') {
      result = [...result].sort((a, b) => {
        const sectionCompare = (a.sectionName ?? '').localeCompare(b.sectionName ?? '')
        if (sectionCompare !== 0) return sectionCompare
        return a.title.localeCompare(b.title)
      })
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title))
    } else if (orderedIds.length > 0) {
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
      result = [...result].sort(
        (a, b) => (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
    }

    return result
  }, [filters.section, items, orderedIds, search, sortBy])

  const displayIds = filteredItems.map((item) => item.id)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = displayIds.indexOf(String(active.id))
    const newIndex = displayIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(displayIds, oldIndex, newIndex)
    setOrderedIds(next)
    setSortBy('default')
  }

  const sortItems = [
    { id: 'default', name: 'Custom order' },
    { id: 'section', name: 'Section' },
    { id: 'title', name: 'Title' },
  ]
  const selectedSort = sortItems.find((item) => item.id === sortBy) ?? sortItems[0]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        filterDefinitions={filterDefinitions}
        filters={filters}
        onFiltersChange={setFilters}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        </span>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sort</span>
          <SearchableSelect<{ id: SortOption; name: string }>
            items={sortItems as Array<{ id: SortOption; name: string }>}
            value={selectedSort as { id: SortOption; name: string }}
            onValueChange={(item) => item && setSortBy(item.id)}
            getItemLabel={(item) => item.name}
            getItemId={(item) => item.id}
            className="w-36"
          />
        </label>
      </div>
      {!filteredItems.length ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayIds} strategy={verticalListSortingStrategy}>
            <div className="max-h-[min(420px,50vh)] space-y-1.5 overflow-auto pr-1">
              {filteredItems.map((item) => (
                <SortableCatalogCard key={item.id} item={item} onItemClick={onItemClick} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

export function linkedResourceVisibilityBadge(isPrivate: boolean) {
  return (
    <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
      {isPrivate ? 'Private' : 'Public'}
    </Badge>
  )
}
