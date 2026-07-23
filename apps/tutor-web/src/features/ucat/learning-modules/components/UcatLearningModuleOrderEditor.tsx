'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, ChevronRight, Folder, GripVertical } from 'lucide-react'
import { Button } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import type { UcatLearningModuleKind, UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import { resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'

type LearningModuleEditorMode = 'edit' | 'view'

type ModuleOrderTreeNode = {
  row: UcatLearningModuleRow
  children: ModuleOrderTreeNode[]
}

export type LearningModuleOrderPlaceholder = {
  id: string
  title: string
  kind: UcatLearningModuleKind
  sectionId: string | null
  parentId: string | null
}

const ROOT_GROUP_KEY = '__root__'

function buildSectionRows(
  modules: UcatLearningModuleRow[],
  sectionId: string | null,
): UcatLearningModuleRow[] {
  const taxonomyRows = modules.map((row) => ({
    id: row.id,
    parent_id: row.parent_ucat_learning_module_id,
    section_id: row.ucat_section_id,
  }))
  return modules.filter((row) => resolveRootSectionId(taxonomyRows, row.id) === sectionId)
}

function buildOrderGroups(rows: UcatLearningModuleRow[]): Record<string, string[]> {
  const sectionIds = new Set(rows.map((row) => row.id))
  const groups: Record<string, string[]> = { [ROOT_GROUP_KEY]: [] }

  for (const row of rows) {
    const parentId = row.parent_ucat_learning_module_id
    const key = parentId && sectionIds.has(parentId) ? parentId : ROOT_GROUP_KEY
    groups[key] = groups[key] ?? []
    groups[key].push(row.id)
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort((aId, bId) => {
      const a = rows.find((row) => row.id === aId)
      const b = rows.find((row) => row.id === bId)
      if (!a || !b) return 0
      return a.index - b.index || a.title.localeCompare(b.title)
    })
  }

  return groups
}

function buildOrderTree(
  rowsById: Map<string, UcatLearningModuleRow>,
  orderGroups: Record<string, string[]>,
  parentKey = ROOT_GROUP_KEY,
): ModuleOrderTreeNode[] {
  return (orderGroups[parentKey] ?? [])
    .map((id) => rowsById.get(id))
    .filter((row): row is UcatLearningModuleRow => row != null)
    .map((row) => ({
      row,
      children: buildOrderTree(rowsById, orderGroups, row.id),
    }))
}

function orderedGroupsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? []).join('|') !== (b[key] ?? []).join('|')) return false
  }
  return true
}

function getNextIndexSlot(
  modules: UcatLearningModuleRow[],
  parentId: string | null,
): number {
  const siblings =
    parentId == null
      ? modules.filter((row) => row.parent_ucat_learning_module_id == null)
      : modules.filter((row) => row.parent_ucat_learning_module_id === parentId)
  if (!siblings.length) return 0
  return Math.max(...siblings.map((row) => row.index)) + 1
}

function getOrderItems(params: {
  orderGroups: Record<string, string[]>
  baselineGroups: Record<string, string[]>
  rowsById: Map<string, UcatLearningModuleRow>
  placeholder?: LearningModuleOrderPlaceholder
  placeholderIndex?: number
}): Array<{ id: string; index: number }> {
  const { orderGroups, baselineGroups, rowsById, placeholder, placeholderIndex } = params
  const items: Array<{ id: string; index: number }> = []

  for (const [key, ids] of Object.entries(orderGroups)) {
    const baselineIds = baselineGroups[key] ?? []
    const comparableIds = ids.filter((id) => id !== placeholder?.id)
    const changed =
      comparableIds.join('|') !== baselineIds.join('|') || ids.includes(placeholder?.id ?? '')
    if (!ids.length || !changed) continue

    const indexSlots = baselineIds
      .map((id) => rowsById.get(id)?.index)
      .filter((index): index is number => typeof index === 'number')

    if (ids.includes(placeholder?.id ?? '') && typeof placeholderIndex === 'number') {
      indexSlots.push(placeholderIndex)
    }

    indexSlots.sort((a, b) => a - b)
    ids.forEach((id, position) => {
      const index = indexSlots[position]
      if (typeof index === 'number') items.push({ id, index })
    })
  }

  return items
}

function SortableOrderRow({
  node,
  currentModuleId,
  placeholderId,
  expandedIds,
  onToggleExpanded,
  disabled,
  children,
}: {
  node: ModuleOrderTreeNode
  currentModuleId: string | null
  placeholderId?: string
  expandedIds: Set<string>
  onToggleExpanded: (id: string) => void
  disabled: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.row.id,
    disabled,
  })
  const isExpanded = expandedIds.has(node.row.id)
  const hasChildren = node.children.length > 0
  const Icon = node.row.kind === 'folder' ? Folder : BookOpen
  const isCurrent = node.row.id === currentModuleId
  const isPlaceholder = node.row.id === placeholderId

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-md', isDragging && 'opacity-60')}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1.5 text-sm transition-colors',
          isCurrent || isPlaceholder
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-black/[0.06] bg-background dark:border-white/10',
        )}
      >
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-muted',
            !hasChildren && 'cursor-default opacity-0',
          )}
          disabled={!hasChildren}
          onClick={() => onToggleExpanded(node.row.id)}
          aria-label={isExpanded ? `Collapse ${node.row.title}` : `Expand ${node.row.title}`}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')} />
        </button>
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted',
            disabled ? 'cursor-default opacity-50' : 'cursor-grab active:cursor-grabbing',
          )}
          aria-label={`Drag ${node.row.title}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={node.row.title}>
          {node.row.title}
        </span>
      </div>
      {hasChildren && isExpanded ? <div className="mt-1 pl-4">{children}</div> : null}
    </li>
  )
}

function ModuleOrderList({
  nodes,
  currentModuleId,
  placeholderId,
  expandedIds,
  onToggleExpanded,
  disabled,
}: {
  nodes: ModuleOrderTreeNode[]
  currentModuleId: string | null
  placeholderId?: string
  expandedIds: Set<string>
  onToggleExpanded: (id: string) => void
  disabled: boolean
}) {
  const ids = nodes.map((node) => node.row.id)

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className="space-y-1">
        {nodes.map((node) => (
          <SortableOrderRow
            key={node.row.id}
            node={node}
            currentModuleId={currentModuleId}
            placeholderId={placeholderId}
            expandedIds={expandedIds}
            onToggleExpanded={onToggleExpanded}
            disabled={disabled}
          >
            <ModuleOrderList
              nodes={node.children}
              currentModuleId={currentModuleId}
              placeholderId={placeholderId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              disabled={disabled}
            />
          </SortableOrderRow>
        ))}
      </ul>
    </SortableContext>
  )
}

export function UcatLearningModuleOrderEditor({
  moduleId,
  sectionId,
  modules,
  editorMode,
  onSaveSectionOrder,
  placeholder,
  onOrderItemsChange,
}: {
  moduleId: string | null
  sectionId: string | null
  modules: UcatLearningModuleRow[]
  editorMode: LearningModuleEditorMode
  onSaveSectionOrder?: (items: Array<{ id: string; index: number }>) => Promise<void>
  placeholder?: LearningModuleOrderPlaceholder
  onOrderItemsChange?: (items: Array<{ id: string; index: number }>) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const placeholderId = placeholder?.id
  const placeholderTitle = placeholder?.title ?? ''
  const placeholderKind = placeholder?.kind
  const placeholderSectionId = placeholder?.sectionId ?? null
  const placeholderParentId = placeholder?.parentId ?? null
  const placeholderIndex = useMemo(
    () => (placeholderId != null ? getNextIndexSlot(modules, placeholderParentId) : undefined),
    [modules, placeholderId, placeholderParentId],
  )
  const modulesWithPlaceholder = useMemo(() => {
    if (placeholderId == null || placeholderKind == null) return modules
    const row: UcatLearningModuleRow = {
      id: placeholderId,
      kind: placeholderKind,
      title:
        placeholderTitle.trim() ||
        (placeholderKind === 'folder' ? 'New folder' : 'New learning module'),
      description: null,
      icon_key: 'book-open',
      estimated_minutes: null,
      ucat_section_id: placeholderSectionId,
      parent_ucat_learning_module_id: placeholderParentId,
      index: placeholderIndex ?? 0,
      is_private: true,
      section_name: null,
      section_number: null,
      child_count: 0,
      block_count: 0,
      updated_at: '',
      study_plan_priority: 'recommended',
      study_plan_category_ids: [],
      study_plan_tag_ids: [],
    }
    return [...modules, row]
  }, [
    modules,
    placeholderId,
    placeholderTitle,
    placeholderKind,
    placeholderSectionId,
    placeholderParentId,
    placeholderIndex,
  ])

  const sectionRows = useMemo(
    () => buildSectionRows(modulesWithPlaceholder, sectionId),
    [modulesWithPlaceholder, sectionId],
  )
  const baselineRows = useMemo(() => buildSectionRows(modules, sectionId), [modules, sectionId])
  const rowsById = useMemo(
    () => new Map(sectionRows.map((row) => [row.id, row] as const)),
    [sectionRows],
  )
  const baselineRowsById = useMemo(
    () => new Map(baselineRows.map((row) => [row.id, row] as const)),
    [baselineRows],
  )
  const baselineGroups = useMemo(() => buildOrderGroups(baselineRows), [baselineRows])
  const initialGroups = useMemo(() => buildOrderGroups(sectionRows), [sectionRows])
  const orderResetSignature = useMemo(
    () =>
      sectionRows
        .map((row) => `${row.id}:${row.parent_ucat_learning_module_id ?? 'root'}:${row.index}:${row.kind}`)
        .join('|'),
    [sectionRows],
  )
  const previousOrderResetSignature = useRef<string | null>(null)
  const [orderGroups, setOrderGroups] = useState<Record<string, string[]>>(initialGroups)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  useEffect(() => {
    if (previousOrderResetSignature.current === orderResetSignature) return
    previousOrderResetSignature.current = orderResetSignature
    setOrderGroups(initialGroups)
    setExpandedIds(new Set(sectionRows.filter((row) => row.kind === 'folder').map((row) => row.id)))
  }, [initialGroups, orderResetSignature, sectionRows])

  const tree = useMemo(() => buildOrderTree(rowsById, orderGroups), [orderGroups, rowsById])
  const isDirty = !orderedGroupsEqual(orderGroups, baselineGroups)
  const orderItems = useMemo(
    () =>
      getOrderItems({
        orderGroups,
        baselineGroups,
        rowsById: baselineRowsById,
        placeholder:
          placeholderId != null && placeholderKind != null
            ? {
                id: placeholderId,
                title: placeholderTitle,
                kind: placeholderKind,
                sectionId: placeholderSectionId,
                parentId: placeholderParentId,
              }
            : undefined,
        placeholderIndex,
      }),
    [
      baselineGroups,
      baselineRowsById,
      orderGroups,
      placeholderId,
      placeholderTitle,
      placeholderKind,
      placeholderSectionId,
      placeholderParentId,
      placeholderIndex,
    ],
  )
  const orderItemsSignature = useMemo(
    () => orderItems.map((item) => `${item.id}:${item.index}`).join('|'),
    [orderItems],
  )
  const previousOrderItemsSignature = useRef('')

  useEffect(() => {
    if (!onOrderItemsChange) return
    if (previousOrderItemsSignature.current === orderItemsSignature) return
    previousOrderItemsSignature.current = orderItemsSignature
    onOrderItemsChange(orderItems)
  }, [onOrderItemsChange, orderItems, orderItemsSignature])

  function handleDragEnd(event: DragEndEvent) {
    if (editorMode === 'view') return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const currentGroup = Object.entries(orderGroups).find(([, ids]) => ids.includes(activeId) && ids.includes(overId))
    if (!currentGroup) return
    const [key, ids] = currentGroup
    const oldIndex = ids.indexOf(activeId)
    const newIndex = ids.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0) return
    setOrderGroups((prev) => ({ ...prev, [key]: arrayMove(ids, oldIndex, newIndex) }))
  }

  async function handleSaveOrder() {
    if (!orderItems.length || !onSaveSectionOrder) return
    setIsSavingOrder(true)
    try {
      await onSaveSectionOrder(orderItems)
    } finally {
      setIsSavingOrder(false)
    }
  }

  if (!sectionRows.length) {
    return <p className="text-xs text-muted-foreground">No modules in this section.</p>
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <ModuleOrderList
          nodes={tree}
          currentModuleId={moduleId}
          placeholderId={placeholder?.id}
          expandedIds={expandedIds}
          onToggleExpanded={(id) =>
            setExpandedIds((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          disabled={editorMode === 'view'}
        />
      </DndContext>
      {onSaveSectionOrder ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={editorMode === 'view' || !isDirty || isSavingOrder}
          onClick={() => void handleSaveOrder()}
        >
          {isSavingOrder ? 'Saving order...' : 'Save order'}
        </Button>
      ) : null}
    </div>
  )
}
