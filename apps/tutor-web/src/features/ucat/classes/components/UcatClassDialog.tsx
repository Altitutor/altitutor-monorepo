'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, ListToolbar, Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui'
import { GripVertical, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatClassSessions } from '@/features/ucat/classes/hooks/useUcatClassSessions'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMocks } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { useQueryClient } from '@tanstack/react-query'
import { ucatClassesApi } from '@/features/ucat/classes/api/classes'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applyRangeFilter,
  applySingleSelectFilter,
  applySort,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import type { DataTableFilterDefinition, Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatSessionWithResources } from '@/features/ucat/classes/api/classes'

/** Stable empty array so useEffect([open, sessions]) does not re-run when query is disabled (data undefined). */
const EMPTY_SESSIONS: UcatSessionWithResources[] = []

type DraftResource = { type: 'set' | 'mock'; resource_id: string; index: number; draftId: string }

function sessionTitle(startAt: string | null): string {
  if (!startAt) return '—'
  const d = new Date(startAt)
  return format(d, 'EEE, d MMM')
}

function sectionSubtitle(section_index: number, section_name: string): string {
  if (section_name) return `${section_index}. ${section_name}`
  return ''
}

function buildDraftFromSessions(sessions: UcatSessionWithResources[]): Record<string, DraftResource[]> {
  const draft: Record<string, DraftResource[]> = {}
  for (const s of sessions) {
    draft[s.session_id] = s.resources.map((r, i) => {
      const resource_id = r.type === 'set' ? r.set_id : r.mock_id
      return {
        type: r.type,
        resource_id,
        index: i,
        draftId: r.id || `draft-${s.session_id}-${r.type}-${resource_id}-${i}`,
      }
    })
  }
  return draft
}

function DroppableSessionWithDraft({
  session,
  draftResources,
  setLookup,
  mockLookup,
  onRemove,
}: {
  session: UcatSessionWithResources
  draftResources: DraftResource[]
  setLookup: (id: string) => { name: string; section_index: number; section_name: string; question_count: number } | null
  mockLookup: (id: string) => { name: string; set_count: number } | null
  onRemove: (sessionId: string, draftId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `session-${session.session_id}` })
  const sortableIds = draftResources.map((r) => `res-${r.draftId}`)

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-muted/30'}`}
    >
      <div className="font-medium text-sm">{sessionTitle(session.start_at)}</div>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="mt-2 space-y-1.5 text-xs">
          {draftResources.map((r) => (
            <DraftResourceRow
              key={r.draftId}
              resource={r}
              setLookup={setLookup}
              mockLookup={mockLookup}
              onRemove={() => onRemove(session.session_id, r.draftId)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function DraftResourceRow({
  resource,
  setLookup,
  mockLookup,
  onRemove,
}: {
  resource: DraftResource
  setLookup: (id: string) => { name: string; section_index: number; section_name: string; question_count: number } | null
  mockLookup: (id: string) => { name: string; set_count: number } | null
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `res-${resource.draftId}`,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const setInfo = resource.type === 'set' ? setLookup(resource.resource_id) : null
  const mockInfo = resource.type === 'mock' ? mockLookup(resource.resource_id) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border border-border/60 bg-background px-2 py-1.5 ${isDragging ? 'opacity-60' : ''}`}
    >
      <button type="button" className="cursor-grab text-muted-foreground shrink-0" {...attributes} {...listeners}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        {resource.type === 'set' && setInfo ? (
          <>
            <div>{setInfo.name}</div>
            <div className="text-muted-foreground">
              {sectionSubtitle(setInfo.section_index, setInfo.section_name)}
            </div>
          </>
        ) : resource.type === 'mock' && mockInfo ? (
          <div>{mockInfo.name}</div>
        ) : (
          <div className="text-muted-foreground">{resource.resource_id}</div>
        )}
      </div>
      {resource.type === 'set' && setInfo ? (
        <span className="shrink-0 text-muted-foreground">{setInfo.question_count} q</span>
      ) : resource.type === 'mock' && mockInfo ? (
        <span className="shrink-0 text-muted-foreground">{mockInfo.set_count} sets</span>
      ) : null}
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  )
}

function DraggableSetItem({
  id,
  name,
  sectionIndex,
  sectionName,
  questionCount,
}: {
  id: string
  name: string
  sectionIndex: number
  sectionName: string
  questionCount: number
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `set-${id}`,
    data: { type: 'set', setId: id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const subtitle = sectionSubtitle(sectionIndex, sectionName)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${isDragging ? 'opacity-60' : ''}`}
    >
      <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div>{name}</div>
        {subtitle ? <div className="text-muted-foreground text-xs">{subtitle}</div> : null}
      </div>
      <span className="shrink-0 text-muted-foreground">{questionCount} q</span>
    </div>
  )
}

function DraggableMockItem({ id, name, setCount }: { id: string; name: string; setCount: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `mock-${id}`,
    data: { type: 'mock', mockId: id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${isDragging ? 'opacity-60' : ''}`}
    >
      <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{name}</div>
      <span className="shrink-0 text-muted-foreground">{setCount} sets</span>
    </div>
  )
}

export function UcatClassDialog({
  open,
  classId,
  onClose,
  onSaved,
}: {
  open: boolean
  classId: string | null
  onClose: () => void
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const { data: sessionsData, isLoading: sessionsLoading } = useUcatClassSessions(open ? classId : null)
  const sessions = sessionsData ?? EMPTY_SESSIONS
  const { data: setsList = [] } = useUcatSets()
  const { data: mocksList = [] } = useUcatMocks()

  const [searchSessions, setSearchSessions] = useState('')
  const [searchSets, setSearchSets] = useState('')
  const [searchMocks, setSearchMocks] = useState('')
  const [filtersSessions, setFiltersSessions] = useState<Record<string, unknown[]>>(() => ({
    from: [format(new Date(), 'yyyy-MM-dd')],
  }))
  const [sortSessionBy, setSortSessionBy] = useState<string | null>('start_at')
  const [sortSessionDirection, setSortSessionDirection] = useState<'asc' | 'desc'>('asc')
  const [filtersSets, setFiltersSets] = useState<Record<string, unknown[]>>({})
  const [filtersMocks, setFiltersMocks] = useState<Record<string, unknown[]>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draftBySession, setDraftBySession] = useState<Record<string, DraftResource[]>>({})
  const [initialDraftSnapshot, setInitialDraftSnapshot] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const sessionFilterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      { key: 'from', label: 'From date', type: 'date' },
      { key: 'to', label: 'To date', type: 'date' },
    ],
    []
  )
  const sessionSortOptions = useMemo(() => [{ key: 'start_at', label: 'Date' }], [])

  const setFilterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'is_student_generated',
        label: 'Origin',
        options: [
          { label: 'Staff', value: 'staff' },
          { label: 'Student', value: 'student' },
        ],
      },
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'time_limit',
        label: 'Time limit (s)',
        type: 'number-range',
        minKey: 'time_limit_min',
        maxKey: 'time_limit_max',
      },
      {
        key: 'stem_count',
        label: 'Question stems',
        type: 'number-range',
        minKey: 'stem_count_min',
        maxKey: 'stem_count_max',
      },
      {
        key: 'question_count',
        label: 'Questions',
        type: 'number-range',
        minKey: 'question_count_min',
        maxKey: 'question_count_max',
      },
    ],
    []
  )

  const mockFilterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
    ],
    []
  )

  useEffect(() => {
    if (open && sessions.length > 0) {
      const draft = buildDraftFromSessions(sessions)
      setDraftBySession(draft)
      setInitialDraftSnapshot(JSON.stringify(draft))
    } else if (!open) {
      setDraftBySession({})
      setInitialDraftSnapshot('')
    }
  }, [open, sessions])

  const setLookup = useMemo(() => {
    const map = new Map<string, { name: string; section_index: number; section_name: string; question_count: number }>()
    for (const row of setsList as Array<{
      id: string | null
      name: unknown
      sections: unknown
      question_count: number | null
    }>) {
      if (!row.id) continue
      const name = proseMirrorToPlainText(row.name as Json | undefined)
      let section_index = 1
      let section_name = ''
      if (Array.isArray(row.sections) && row.sections[0] && typeof row.sections[0] === 'object') {
        const first = row.sections[0] as { section_number?: number; name?: Json }
        section_index = typeof first.section_number === 'number' ? first.section_number : 1
        section_name = proseMirrorToPlainText(first.name)
      }
      map.set(row.id, { name, section_index, section_name, question_count: row.question_count ?? 0 })
    }
    return (id: string) => map.get(id) ?? null
  }, [setsList])

  const mockLookup = useMemo(() => {
    const map = new Map<string, { name: string; set_count: number }>()
    for (const row of mocksList as Array<{ id: string | null; name: string | null; set_count?: number }>) {
      if (row.id) map.set(row.id, { name: row.name ?? 'Untitled', set_count: row.set_count ?? 0 })
    }
    return (id: string) => map.get(id) ?? null
  }, [mocksList])

  const filteredSessions = useMemo(() => {
    let list = sessions
    const fromVal = (filtersSessions.from as string[])?.[0]
    const toVal = (filtersSessions.to as string[])?.[0]
    if (fromVal || toVal) {
      list = list.filter((s) => {
        const d = s.start_at ? s.start_at.slice(0, 10) : ''
        if (fromVal && d < fromVal) return false
        if (toVal && d > toVal) return false
        return true
      })
    }
    if (searchSessions.trim()) {
      list = list.filter((s) =>
        applyCoreStringFilter(sessionTitle(s.start_at), searchSessions)
      )
    }
    return list
  }, [sessions, filtersSessions, searchSessions])

  const sortedSessions = useMemo(
    () =>
      applySort(filteredSessions, sortSessionBy, sortSessionDirection, {
        start_at: (s) => s.start_at ?? '',
      }),
    [filteredSessions, sortSessionBy, sortSessionDirection]
  )

  const setsTableState = useMemo(
    () => ({ search: searchSets, filters: filtersSets, sortBy: null, sortDirection: 'desc' as const, groupBy: null, page: 1, pageSize: 20, visibleColumns: [] }),
    [searchSets, filtersSets]
  )

  const filteredSets = useMemo(() => {
    const list = setsList as Array<{
      id: string | null
      name: unknown
      sections: unknown
      question_count: number | null
      time_limit_seconds: number | null
      is_private: boolean | null
      is_student_generated: boolean | null
      stem_count?: number
    }>
    return list.filter((row) => {
      const name = proseMirrorToPlainText(row.name as Json | undefined)
      const sectionName = Array.isArray(row.sections)
        ? proseMirrorToPlainText((row.sections[0] as { name?: Json })?.name)
        : ''
      const searchHit =
        !searchSets.trim() ||
        applyCoreStringFilter(name, searchSets) ||
        applyCoreStringFilter(sectionName, searchSets)
      const visibilityHit = applyBooleanTextFilter(setsTableState, 'visibility', !!row.is_private)
      const originValue = row.is_student_generated ? 'student' : 'staff'
      const originHit = applySingleSelectFilter(setsTableState, 'is_student_generated', originValue)
      const timeLimitHit = applyRangeFilter(
        setsTableState,
        'time_limit_min',
        'time_limit_max',
        row.time_limit_seconds ?? null
      )
      const stemCountHit = applyRangeFilter(
        setsTableState,
        'stem_count_min',
        'stem_count_max',
        row.stem_count ?? null
      )
      const questionCountHit = applyRangeFilter(
        setsTableState,
        'question_count_min',
        'question_count_max',
        row.question_count ?? null
      )
      return searchHit && visibilityHit && originHit && timeLimitHit && stemCountHit && questionCountHit
    })
  }, [setsList, searchSets, setsTableState])

  const mocksTableState = useMemo(
    () => ({ search: searchMocks, filters: filtersMocks, sortBy: null, sortDirection: 'desc' as const, groupBy: null, page: 1, pageSize: 20, visibleColumns: [] }),
    [searchMocks, filtersMocks]
  )

  const filteredMocks = useMemo(() => {
    const list = mocksList as Array<{ id: string | null; name: string | null; set_count?: number; is_private?: boolean | null }>
    return list.filter((row) => {
      const searchHit = !searchMocks.trim() || applyCoreStringFilter(row.name ?? '', searchMocks)
      const visibilityHit = applyBooleanTextFilter(mocksTableState, 'visibility', !!row.is_private)
      return searchHit && visibilityHit
    })
  }, [mocksList, searchMocks, mocksTableState])

  const isDirty = useMemo(() => {
    const current = JSON.stringify(draftBySession)
    return current !== initialDraftSnapshot
  }, [draftBySession, initialDraftSnapshot])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    if (activeStr.startsWith('res-')) {
      if (!overStr.startsWith('res-')) return
      const activeDraftId = activeStr.replace('res-', '')
      const overDraftId = overStr.replace('res-', '')
      if (activeDraftId === overDraftId) return
      for (const sessionId of Object.keys(draftBySession)) {
        const list = draftBySession[sessionId]
        const fromIdx = list.findIndex((r) => r.draftId === activeDraftId)
        const toIdx = list.findIndex((r) => r.draftId === overDraftId)
        if (fromIdx >= 0 && toIdx >= 0) {
          const reordered = arrayMove(list, fromIdx, toIdx).map((r, i) => ({ ...r, index: i }))
          setDraftBySession((prev) => ({ ...prev, [sessionId]: reordered }))
          return
        }
      }
      return
    }

    if ((activeStr.startsWith('set-') || activeStr.startsWith('mock-')) && overStr.startsWith('session-')) {
      const sessionId = overStr.replace('session-', '')
      const type = activeStr.startsWith('set-') ? 'set' : 'mock'
      const resource_id = activeStr.startsWith('set-') ? activeStr.replace('set-', '') : activeStr.replace('mock-', '')
      const list = draftBySession[sessionId] ?? []
      const draftId = `draft-${sessionId}-${type}-${resource_id}-${Date.now()}`
      const newResource: DraftResource = { type, resource_id, index: list.length, draftId }
      setDraftBySession((prev) => ({
        ...prev,
        [sessionId]: [...list, newResource],
      }))
    }
  }

  const handleRemove = (sessionId: string, draftId: string) => {
    setDraftBySession((prev) => {
      const list = (prev[sessionId] ?? []).filter((r) => r.draftId !== draftId).map((r, i) => ({ ...r, index: i }))
      return { ...prev, [sessionId]: list }
    })
  }

  const handleSave = async () => {
    if (!classId || !isDirty) return
    setIsSaving(true)
    try {
      const assignments = Object.entries(draftBySession).map(([session_id, resources]) => ({
        session_id,
        resources: resources.map((r, index) => ({
          resource_type: r.type,
          resource_id: r.resource_id,
          index,
        })),
      }))
      await ucatClassesApi.replaceSessionResources(assignments)
      queryClient.invalidateQueries({ queryKey: ucatKeys.classes() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      onSaved?.()
      onClose()
    } catch (_) {
      // TODO: toast error
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title="Edit class sessions"
      subtitle="Assign sets and mocks to sessions. Reorder or remove with the list. Save when done."
      onSave={handleSave}
      saveDisabled={!isDirty || isSaving}
      isSaving={isSaving}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full flex">
          <section className="flex-1 min-w-0 overflow-y-auto border-r p-6 space-y-3">
            <h2 className="font-semibold">Sessions</h2>
            <ListToolbar
              search={searchSessions}
              onSearchChange={setSearchSessions}
              searchPlaceholder="Search sessions"
              filterDefinitions={sessionFilterDefinitions}
              filters={filtersSessions}
              onFiltersChange={setFiltersSessions}
              sortOptions={sessionSortOptions}
              sortBy={sortSessionBy}
              sortDirection={sortSessionDirection}
              onSortChange={(field, direction) => {
                setSortSessionBy(field)
                setSortSessionDirection(direction)
              }}
            />
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading sessions...</p>
            ) : sortedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions match your filters.</p>
            ) : (
              <div className="space-y-3">
                {sortedSessions.map((session) => (
                  <DroppableSessionWithDraft
                    key={session.session_id}
                    session={session}
                    draftResources={draftBySession[session.session_id] ?? []}
                    setLookup={setLookup}
                    mockLookup={mockLookup}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="w-96 flex-shrink-0 overflow-y-auto border-l p-6 space-y-3">
            <Tabs defaultValue="sets">
              <TabsList className="w-full">
                <TabsTrigger value="sets" className="flex-1">Sets</TabsTrigger>
                <TabsTrigger value="mocks" className="flex-1">Mocks</TabsTrigger>
              </TabsList>
              <TabsContent value="sets" className="mt-3 pt-4 space-y-2 m-0">
                <ListToolbar
                  search={searchSets}
                  onSearchChange={setSearchSets}
                  searchPlaceholder="Filter sets"
                  filterDefinitions={setFilterDefinitions}
                  filters={filtersSets}
                  onFiltersChange={setFiltersSets}
                />
                <div className="space-y-1.5 max-h-96 overflow-auto">
                  {filteredSets.map((row) => {
                    const id = row.id ?? ''
                    const name = proseMirrorToPlainText(row.name as Json | undefined)
                    let sectionIndex = 1
                    let sectionName = ''
                    if (Array.isArray(row.sections) && row.sections[0] && typeof row.sections[0] === 'object') {
                      const first = row.sections[0] as { section_number?: number; name?: Json }
                      sectionIndex = typeof first.section_number === 'number' ? first.section_number : 1
                      sectionName = proseMirrorToPlainText(first.name)
                    }
                    return (
                      <DraggableSetItem
                        key={id}
                        id={id}
                        name={name}
                        sectionIndex={sectionIndex}
                        sectionName={sectionName}
                        questionCount={row.question_count ?? 0}
                      />
                    )
                  })}
                </div>
              </TabsContent>
              <TabsContent value="mocks" className="mt-3 pt-4 space-y-2 m-0">
                <ListToolbar
                  search={searchMocks}
                  onSearchChange={setSearchMocks}
                  searchPlaceholder="Filter mocks"
                  filterDefinitions={mockFilterDefinitions}
                  filters={filtersMocks}
                  onFiltersChange={setFiltersMocks}
                />
                <div className="space-y-1.5 max-h-96 overflow-auto">
                  {filteredMocks.map((row) => (
                    <DraggableMockItem
                      key={row.id ?? ''}
                      id={row.id ?? ''}
                      name={row.name ?? 'Untitled'}
                      setCount={row.set_count ?? 0}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </DndContext>
    </UcatDialogShell>
  )
}
