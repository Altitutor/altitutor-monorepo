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
import { Badge, Button, getUcatVisibilityColor, Input, ListToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { SortableRow } from '@/features/ucat/shared/drag-list'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { formatSecondsToDuration, minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { cn } from '@/shared/utils'
import { Info, Pencil, Plus } from 'lucide-react'

export type UcatSectionForTimeLimit = {
  id: string
  name: string | null
  time_limit_seconds: number | null
  time_per_question?: number | null
  number_of_questions?: number | null
}
import React from 'react'

const STEMS_DROP_ID = 'stems-in-set-drop'

type UcatSetEditorContentProps = {
  draftName: string
  draftDescription: string
  draftIsTimed: boolean
  draftTimeLimitMinutes: string
  draftTimeLimitSeconds: string
  draftTimeLimitSource: 'untimed' | 'section_full' | 'section_auto' | 'custom'
  draftTimeLimitSpeed: number
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
  onChangeTimeLimitSource: (value: 'untimed' | 'section_full' | 'section_auto' | 'custom') => void
  onChangeTimeLimitSpeed: (value: number) => void
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
  draftTimeLimitSource,
  draftTimeLimitSpeed,
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
  onChangeTimeLimitSource,
  onChangeTimeLimitSpeed,
  onChangePrivate,
  sections = [],
}: UcatSetEditorContentProps) {
  const setSectionsFromStems = React.useMemo(() => {
    const sectionMap = new Map<
      string,
      { sectionId: string; sectionNumber: number; questionCount: number }
    >()
    for (const stemId of draftStemIds) {
      const stem = stemCatalog.find((s) => s.id === stemId)
      if (!stem?.sectionId) continue
      const existing = sectionMap.get(stem.sectionId)
      if (existing) {
        existing.questionCount += stem.questionsCount
      } else {
        sectionMap.set(stem.sectionId, {
          sectionId: stem.sectionId,
          sectionNumber: stem.sectionNumber,
          questionCount: stem.questionsCount,
        })
      }
    }
    return Array.from(sectionMap.values())
  }, [draftStemIds, stemCatalog])

  const setSectionCount = setSectionsFromStems.length
  const firstSetSection = setSectionsFromStems[0]
  const firstUcatSection = firstSetSection
    ? sections.find((s) => s.id === firstSetSection.sectionId)
    : null

  const sectionFullTimeSeconds = firstUcatSection?.time_limit_seconds ?? null
  const sectionAutoTimeSeconds = React.useMemo(() => {
    let total = 0
    for (const ss of setSectionsFromStems) {
      const sec = sections.find((s) => s.id === ss.sectionId)
      const tpq = sec?.time_per_question
      if (tpq != null && tpq > 0) {
        total += ss.questionCount * tpq
      }
    }
    return total > 0 ? total : null
  }, [setSectionsFromStems, sections])

  const sectionFullTimeFormatted =
    sectionFullTimeSeconds != null && sectionFullTimeSeconds > 0
      ? formatSecondsToDuration(sectionFullTimeSeconds)
      : null
  const sectionAutoTimeFormatted =
    sectionAutoTimeSeconds != null && sectionAutoTimeSeconds > 0
      ? formatSecondsToDuration(sectionAutoTimeSeconds)
      : null

  const effectiveTimeSeconds = React.useMemo(() => {
    if (draftTimeLimitSource === 'untimed' || !draftIsTimed) return null
    if (draftTimeLimitSource === 'section_full' && setSectionCount === 1 && sectionFullTimeSeconds != null && sectionFullTimeSeconds > 0) {
      return sectionFullTimeSeconds
    }
    if (draftTimeLimitSource === 'section_auto' && setSectionCount === 1 && sectionAutoTimeSeconds != null) {
      const speed = Math.max(0.1, Math.min(2, draftTimeLimitSpeed))
      return Math.round(sectionAutoTimeSeconds / speed)
    }
    return minutesSecondsToTotal(draftTimeLimitMinutes, draftTimeLimitSeconds)
  }, [
    draftIsTimed,
    draftTimeLimitSource,
    draftTimeLimitSpeed,
    draftTimeLimitMinutes,
    draftTimeLimitSeconds,
    setSectionCount,
    sectionFullTimeSeconds,
    sectionAutoTimeSeconds,
  ])

  const timeLimitTooltips: Record<string, string> = {
    untimed: 'No time limit for this set.',
    section_full:
      "Uses the section's full exam time limit. Only available when the set contains questions from a single section.",
    section_auto:
      'Uses section time-per-question × number of questions for each section in the set. Speed: 1× = exam pace, higher = less time (faster), lower = more time (slower).',
    custom: 'Set a custom time limit in minutes and seconds.',
  }

  const [isEditingTimeLimit, setIsEditingTimeLimit] = React.useState(false)
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
              <div className="block text-sm">
                <span className="mb-1 block font-medium">Time limit</span>
                {!isEditingTimeLimit ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {effectiveTimeSeconds != null && effectiveTimeSeconds > 0
                        ? formatSecondsToDuration(effectiveTimeSeconds)
                        : 'Untimed'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingTimeLimit(true)}
                    >
                      Edit
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={draftTimeLimitSource}
                        onValueChange={(v) => {
                          const val = v as 'untimed' | 'section_full' | 'section_auto' | 'custom'
                          onChangeTimeLimitSource(val)
                          if (val === 'untimed') {
                            onChangeIsTimed(false)
                          } else {
                            onChangeIsTimed(true)
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="untimed">Untimed</SelectItem>
                          <SelectItem value="section_full" disabled={setSectionCount !== 1}>
                            Section full exam time
                            {sectionFullTimeFormatted && (
                              <span className="text-muted-foreground"> ({sectionFullTimeFormatted})</span>
                            )}
                          </SelectItem>
                          <SelectItem value="section_auto" disabled={setSectionCount !== 1}>
                            Section exam auto timing
                            {sectionAutoTimeFormatted && (
                              <span className="text-muted-foreground"> ({sectionAutoTimeFormatted})</span>
                            )}
                          </SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 shrink-0 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            {timeLimitTooltips[draftTimeLimitSource]}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {setSectionCount > 1 && draftTimeLimitSource === 'section_auto' && (
                      <p className="text-xs text-destructive">
                        Auto timing is not available for sets with multiple sections.
                      </p>
                    )}
                    {draftTimeLimitSource === 'section_full' &&
                      firstUcatSection != null &&
                      firstSetSection != null &&
                      firstUcatSection.number_of_questions != null &&
                      firstSetSection.questionCount !== firstUcatSection.number_of_questions && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          Warning: Section has {firstUcatSection.number_of_questions} questions; this set has{' '}
                          {firstSetSection.questionCount}.
                        </p>
                      )}
                    {draftTimeLimitSource === 'section_auto' && setSectionCount === 1 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span>Speed</span>
                          <span className="text-muted-foreground">
                            {draftTimeLimitSpeed === 1 ? '1× exam pace' : `${draftTimeLimitSpeed.toFixed(1)}×`}
                          </span>
                        </div>
                        <Slider
                          min={0.1}
                          max={2}
                          step={0.1}
                          value={[Math.max(0.1, Math.min(2, draftTimeLimitSpeed))]}
                          onValueChange={([v]) => onChangeTimeLimitSpeed(v)}
                        />
                      </div>
                    )}
                    {draftTimeLimitSource === 'custom' && (
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
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Time limit: {effectiveTimeSeconds != null && effectiveTimeSeconds > 0 ? formatSecondsToDuration(effectiveTimeSeconds) : 'Untimed'}
                    </p>
                    <Button type="button" size="sm" onClick={() => setIsEditingTimeLimit(false)}>
                      Save
                    </Button>
                  </div>
                )}
              </div>
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
