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
import { Badge, Button, getUcatVisibilityColor, Input, ListToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { SortableRow } from '@/features/ucat/shared/drag-list'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { formatSecondsToDuration, secondsToMinutesAndSeconds } from '@/features/ucat/shared/lib/time-utils'
import { cn } from '@/shared/utils'
import { Pencil, Plus } from 'lucide-react'

export type UcatSectionForTimeLimit = {
  id: string
  name: string | null
  time_limit_seconds: number | null
}
import React from 'react'

const STEMS_DROP_ID = 'stems-in-set-drop'

type UcatSetEditorContentProps = {
  draftName: string
  draftDescription: string
  draftIsTimed: boolean
  draftTimeLimitMinutes: string
  draftTimeLimitSeconds: string
  draftPrivate: boolean
  draftStemIds: string[]
  setDraftStemIds: React.Dispatch<React.SetStateAction<string[]>>
  stemCatalog: UcatStemCatalogItem[]
  search: string
  setSearch: (value: string) => void
  filters: Record<string, unknown[]>
  setFilters: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  onEditStem: (id: string) => void
  onChangeName: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangeIsTimed: (value: boolean) => void
  onChangeTimeLimitMinutes: (value: string) => void
  onChangeTimeLimitSeconds: (value: string) => void
  onChangePrivate: (value: boolean) => void
  sections?: UcatSectionForTimeLimit[]
}

function DraggableStemItem({
  stem,
  onAdd,
  onEdit,
}: {
  stem: UcatStemCatalogItem
  onAdd: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${stem.id}`,
    data: { type: 'catalog-stem', stemId: stem.id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full cursor-grab items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div className="min-w-0">
          <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem.text || stem.id}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{stem.sectionNumber}. {stem.sectionName}</span>
            <Badge variant="outline" className={cn('text-[10px] font-normal px-1.5 py-0', getUcatVisibilityColor(stem.isPrivate))}>
              {stem.isPrivate ? 'Private' : 'Public'}
            </Badge>
            <span>· {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit() }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="default" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); onAdd() }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function UcatSetEditorContent({
  draftName,
  draftDescription,
  draftIsTimed,
  draftTimeLimitMinutes,
  draftTimeLimitSeconds,
  draftPrivate,
  draftStemIds,
  setDraftStemIds,
  stemCatalog,
  search,
  setSearch,
  filters,
  setFilters,
  filterDefinitions,
  onEditStem,
  onChangeName,
  onChangeDescription,
  onChangeIsTimed,
  onChangeTimeLimitMinutes,
  onChangeTimeLimitSeconds,
  onChangePrivate,
  sections = [],
}: UcatSetEditorContentProps) {
  const sectionsWithTimeLimit = React.useMemo(
    () => sections.filter((s) => s.time_limit_seconds != null && s.time_limit_seconds > 0),
    [sections]
  )
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: STEMS_DROP_ID })

  const activeStem = React.useMemo(() => {
    if (!activeId || !activeId.startsWith('catalog-')) return null
    const stemId = activeId.replace('catalog-', '')
    return stemCatalog.find((s) => s.id === stemId) ?? null
  }, [activeId, stemCatalog])

  const availableStems = React.useMemo(
    () => stemCatalog.filter((stem) => !draftStemIds.includes(stem.id)).slice(0, 60),
    [stemCatalog, draftStemIds]
  )

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

      if (activeStr.startsWith('catalog-')) {
        const stemId = activeStr.replace('catalog-', '')
        if (overStr === STEMS_DROP_ID || draftStemIds.includes(overStr)) {
          setDraftStemIds((prev) => (prev.includes(stemId) ? prev : [...prev, stemId]))
        }
        return
      }

      const oldIndex = draftStemIds.indexOf(activeStr)
      const newIndex = draftStemIds.indexOf(overStr)
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setDraftStemIds((prev) => arrayMove(prev, oldIndex, newIndex))
      }
    },
    [draftStemIds, setDraftStemIds]
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        <section className="min-w-0 flex-1 overflow-y-auto border-r p-6 space-y-3">
          <h2 className="font-semibold">Stems in Set</h2>
          <div ref={setDropRef} className={isOver ? 'rounded ring-2 ring-primary/50 ring-offset-2' : ''}>
            <SortableContext items={draftStemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {draftStemIds.map((id, index) => {
                  const stem = stemCatalog.find((item) => item.id === id)
                  return (
                    <SortableRow
                      key={id}
                      id={id}
                      label={
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
                          <div className="min-w-0">
                            <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem?.text || id}</div>
                            {stem && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>{stem.sectionNumber}. {stem.sectionName}</span>
                                <Badge variant="outline" className={cn('text-[10px] font-normal px-1.5 py-0', getUcatVisibilityColor(stem.isPrivate))}>
                                  {stem.isPrivate ? 'Private' : 'Public'}
                                </Badge>
                                <span>
                                  · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      }
                      onRemove={() => setDraftStemIds((prev) => prev.filter((stemId) => stemId !== id))}
                      onEdit={() => onEditStem(id)}
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
              <TabsTrigger value="add-stems" className="flex-1">
                Add Stems
              </TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="mt-3 space-y-3 m-0 pt-4">
              <h2 className="font-semibold">Set Properties</h2>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Description</span>
                <Textarea className="min-h-24" value={draftDescription} onChange={(e) => onChangeDescription(e.target.value)} />
              </label>
              <label className="block text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">Time limit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Untimed</span>
                    <Switch checked={draftIsTimed} onCheckedChange={onChangeIsTimed} />
                    <span className="text-xs text-muted-foreground">Timed</span>
                  </div>
                </div>
                {draftIsTimed && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      className="w-20"
                      value={draftTimeLimitMinutes}
                      onChange={(e) => onChangeTimeLimitMinutes(e.target.value)}
                    />
                    <span className="text-muted-foreground font-medium">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      placeholder="0"
                      className="w-20"
                      value={draftTimeLimitSeconds}
                      onChange={(e) => onChangeTimeLimitSeconds(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">min : sec</span>
                    {sectionsWithTimeLimit.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(value) => {
                          const sec = sectionsWithTimeLimit.find((s) => s.id === value)
                          if (sec?.time_limit_seconds != null) {
                            const { minutes, seconds } = secondsToMinutesAndSeconds(sec.time_limit_seconds)
                            onChangeTimeLimitMinutes(minutes)
                            onChangeTimeLimitSeconds(seconds)
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Use section time" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionsWithTimeLimit.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name ?? 'Unknown'} ({formatSecondsToDuration(s.time_limit_seconds)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Visibility</span>
                <Select value={draftPrivate ? 'private' : 'public'} onValueChange={(v) => onChangePrivate(v === 'private')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </TabsContent>
            <TabsContent value="add-stems" className="mt-3 m-0 pt-4 space-y-2">
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search stems"
                filterDefinitions={filterDefinitions}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <div className="max-h-96 space-y-1 overflow-auto">
                {availableStems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stems to add, or all matching stems are already in the set.</p>
                ) : (
                  availableStems.map((stem) => (
                    <DraggableStemItem
                      key={stem.id}
                      stem={stem}
                      onAdd={() => setDraftStemIds((prev) => (prev.includes(stem.id) ? prev : [...prev, stem.id]))}
                      onEdit={() => onEditStem(stem.id)}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <DragOverlay>
        {activeStem ? (
          <div className="flex w-full min-w-[280px] items-start justify-between gap-2 rounded border border-border bg-background px-2 py-2 shadow-lg text-left text-sm">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="min-w-0">
                <div className="line-clamp-2 break-words text-xs sm:text-sm">{activeStem.text || activeStem.id}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{activeStem.sectionNumber}. {activeStem.sectionName}</span>
                  <Badge variant="outline" className={cn('text-[10px] font-normal px-1.5 py-0', getUcatVisibilityColor(activeStem.isPrivate))}>
                    {activeStem.isPrivate ? 'Private' : 'Public'}
                  </Badge>
                  <span>· {activeStem.questionsCount} {activeStem.questionsCount === 1 ? 'question' : 'questions'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
