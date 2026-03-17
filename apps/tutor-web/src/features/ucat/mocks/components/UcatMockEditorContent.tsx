'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Badge,
  Button,
  getUcatVisibilityColor,
  Input,
  ListToolbar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { SortableRow } from '@/features/ucat/shared/drag-list'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applyRangeFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { getSetSectionStatus } from '@/features/ucat/shared/lib/set-section-status'
import { cn } from '@/shared/utils'
import { GripVertical, Pencil, Plus } from 'lucide-react'
import React from 'react'

const SETS_DROP_ID = 'sets-in-mock-drop'
const CATALOG_PREFIX = 'catalog-set-'

type UcatMockEditorContentProps = {
  name: string
  isPrivate: boolean
  instructionsText: RichTextJson | null
  setInstructionsText: (value: RichTextJson | null) => void
  setName: (value: string) => void
  setIsPrivate: (value: boolean) => void
  draftSetIds: string[]
  setDraftSetIds: React.Dispatch<React.SetStateAction<string[]>>
  search: string
  setSearch: (value: string) => void
  filters?: Record<string, unknown[]>
  setFilters?: (value: Record<string, unknown[]>) => void
  filterDefinitions?: DataTableFilterDefinition[]
  setCatalog: SetOption[]
  sections?: Array<{ id: string | null; section_number: number | null; name: string | null; number_of_questions: number | null; time_limit_seconds: number | null }>
  onEditSet?: (setId: string) => void
}

function SetSubtitleParts({
  set,
  sections,
}: {
  set: SetOption
  sections: Array<{ id: string | null; section_number: number | null; name: string | null; number_of_questions: number | null; time_limit_seconds: number | null }>
}) {
  const status = getSetSectionStatus(
    {
      sectionCount: set.sectionCount,
      firstSectionNumber: set.firstSectionNumber,
      question_count: set.question_count,
      time_limit_seconds: set.time_limit_seconds,
    },
    sections
  )
  return (
    <>
      {set.sectionDisplay ? (
        <SetStatusSpan status={status.sectionsStatus} tooltip={status.sectionsTooltip}>
          {set.sectionDisplay}
        </SetStatusSpan>
      ) : null}
      <Badge variant="outline" className={cn('text-[10px] font-normal px-1.5 py-0', getUcatVisibilityColor(!!set.is_private))}>
        {set.is_private ? 'Private' : 'Public'}
      </Badge>
      <SetStatusSpan status={status.questionCountStatus} tooltip={status.questionCountTooltip}>
        · {set.question_count != null ? `${set.question_count} Q` : '—'}
      </SetStatusSpan>
      <SetStatusSpan status={status.timeLimitStatus} tooltip={status.timeLimitTooltip}>
        · {formatSetTimeLimit(set.time_limit_seconds)}
      </SetStatusSpan>
    </>
  )
}

function DraggableSetItem({
  set,
  sections,
  onAdd,
  onEdit,
}: {
  set: SetOption
  sections: Array<{ id: string | null; section_number: number | null; name: string | null; number_of_questions: number | null; time_limit_seconds: number | null }>
  onAdd: () => void
  onEdit?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${CATALOG_PREFIX}${set.id}`,
    data: { type: 'catalog-set', setId: set.id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-start justify-between gap-4 rounded border px-3 py-2 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <button type="button" className="cursor-grab shrink-0 pt-0.5 text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="font-medium">{set.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <SetSubtitleParts set={set} sections={sections} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit && (
          <Button type="button" variant="outline" size="icon" className="text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" variant="default" size="icon" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function UcatMockEditorContent({
  name,
  isPrivate,
  instructionsText,
  setInstructionsText,
  setName,
  setIsPrivate,
  draftSetIds,
  setDraftSetIds,
  search,
  setSearch,
  filters = {},
  setFilters = () => {},
  filterDefinitions = [],
  setCatalog,
  sections = [],
  onEditSet,
}: UcatMockEditorContentProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: SETS_DROP_ID })

  const activeSet = React.useMemo(() => {
    if (!activeId || !activeId.startsWith(CATALOG_PREFIX)) return null
    const setId = activeId.replace(CATALOG_PREFIX, '')
    return setCatalog.find((s) => s.id === setId) ?? null
  }, [activeId, setCatalog])

  const setsTableState = React.useMemo(
    () => ({
      search,
      filters,
      sortBy: null,
      sortDirection: 'desc' as const,
      groupBy: null,
      page: 1,
      pageSize: 100,
      visibleColumns: [] as string[],
    }),
    [search, filters]
  )

  const filtered = React.useMemo(() => {
    return setCatalog.filter((set) => {
      if (draftSetIds.includes(set.id)) return false
      const searchHit =
        !search.trim() ||
        applyCoreStringFilter(set.name, search) ||
        applyCoreStringFilter(set.sectionDisplay, search)
      const visibilityHit = applyBooleanTextFilter(setsTableState, 'visibility', !!set.is_private)
      const timeLimitHit = applyRangeFilter(
        setsTableState,
        'time_limit_min',
        'time_limit_max',
        set.time_limit_seconds ?? null
      )
      const stemCountHit = applyRangeFilter(
        setsTableState,
        'stem_count_min',
        'stem_count_max',
        set.stem_count ?? null
      )
      const questionCountHit = applyRangeFilter(
        setsTableState,
        'question_count_min',
        'question_count_max',
        set.question_count ?? null
      )
      return searchHit && visibilityHit && timeLimitHit && stemCountHit && questionCountHit
    })
  }, [draftSetIds, search, setCatalog, setsTableState])

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over) return

      const activeStr = String(active.id)
      const overStr = String(over.id)

      if (activeStr.startsWith(CATALOG_PREFIX)) {
        const setId = activeStr.replace(CATALOG_PREFIX, '')
        if (overStr === SETS_DROP_ID || draftSetIds.includes(overStr)) {
          setDraftSetIds((prev) => (prev.includes(setId) ? prev : [...prev, setId]))
        }
        return
      }

      const oldIndex = draftSetIds.indexOf(activeStr)
      const newIndex = draftSetIds.indexOf(overStr)
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setDraftSetIds((prev) => arrayMove(prev, oldIndex, newIndex))
      }
    },
    [draftSetIds, setDraftSetIds]
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        <section className="min-w-0 flex-1 overflow-y-auto border-r p-6 space-y-3">
          <h2 className="font-semibold">Sets in Mock</h2>
          <div ref={setDropRef} className={isOver ? 'rounded ring-2 ring-primary/50 ring-offset-2' : ''}>
            <SortableContext items={draftSetIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {draftSetIds.map((id, index) => {
                  const set = setCatalog.find((item) => item.id === id)
                  if (!set) {
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        label={
                          <>
                            <span className="font-medium">{index + 1}.</span> {id.slice(0, 8)}
                          </>
                        }
                        onRemove={() => setDraftSetIds((prev) => prev.filter((setId) => setId !== id))}
                        onEdit={onEditSet ? () => onEditSet(id) : undefined}
                        removeButtonVariant="destructive"
                      />
                    )
                  }
                  return (
                    <SortableRow
                      key={id}
                      id={id}
                      label={
                        <div className="min-w-0">
                          <div>
                            <span className="font-medium">{index + 1}.</span> {set.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <SetSubtitleParts set={set} sections={sections} />
                          </div>
                        </div>
                      }
                      onRemove={() => setDraftSetIds((prev) => prev.filter((setId) => setId !== id))}
                      onEdit={onEditSet ? () => onEditSet(id) : undefined}
                      removeButtonVariant="destructive"
                    />
                  )
                })}
              </div>
            </SortableContext>
          </div>
        </section>

        <aside className="w-96 flex-shrink-0 overflow-y-auto border-l p-6 space-y-3">
          <Tabs defaultValue="properties">
            <TabsList className="w-full">
              <TabsTrigger value="properties" className="flex-1">
                Properties
              </TabsTrigger>
              <TabsTrigger value="add-sets" className="flex-1">
                Add Sets
              </TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="mt-3 space-y-3 m-0 pt-4">
              <h2 className="font-semibold">Mock Properties</h2>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Visibility</span>
                <Select value={isPrivate ? 'private' : 'public'} onValueChange={(v) => setIsPrivate(v === 'private')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Instructions</span>
                <p className="mb-1 text-muted-foreground text-xs">
                  Shown to students at the start of the mock before set instructions.
                </p>
                <div className="rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background px-2">
                  <UcatRichTextEditor
                    value={instructionsText}
                    onChange={(value) => setInstructionsText(value)}
                    placeholder="Optional mock instructions..."
                    minHeight="120px"
                  />
                </div>
              </label>
            </TabsContent>
            <TabsContent value="add-sets" className="mt-3 m-0 pt-4 space-y-2">
              {filterDefinitions.length > 0 ? (
                <ListToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Filter sets"
                  filterDefinitions={filterDefinitions}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              ) : (
                <Input
                  placeholder="Search sets"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
              )}
              <div className="max-h-96 space-y-1 overflow-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sets to add, or all matching sets are already in the mock.</p>
                ) : (
                  filtered.slice(0, 50).map((set) => (
                    <DraggableSetItem
                      key={set.id}
                      set={set}
                      sections={sections}
                      onAdd={() => setDraftSetIds((prev) => (prev.includes(set.id) ? prev : [...prev, set.id]))}
                      onEdit={onEditSet ? () => onEditSet(set.id) : undefined}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <DragOverlay>
        {activeSet ? (
          <div className="flex w-full min-w-[280px] items-start justify-between gap-4 rounded border border-border bg-background px-3 py-2 shadow-lg">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="shrink-0 pt-0.5 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{activeSet.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <SetSubtitleParts set={activeSet} sections={sections} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
