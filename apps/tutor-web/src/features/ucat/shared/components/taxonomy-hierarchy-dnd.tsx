'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  findTaxonomyNode,
  taxonomyDragId,
  taxonomyDropId,
  taxonomySectionDropId,
  type TaxonomyHierarchyNode,
  type TaxonomyReparentTarget,
} from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'

type TaxonomyHierarchyDndProviderProps = {
  allNodes: TaxonomyHierarchyNode[]
  onReparent: (itemId: string, target: TaxonomyReparentTarget) => void
  /** Same-parent sibling reorder (sortable drop onto another item). */
  onReorder?: (itemId: string, overItemId: string) => void
  children: React.ReactNode
}

function stripTaxonomyDragPrefix(id: string): string {
  return id.startsWith('taxonomy-') ? id.slice('taxonomy-'.length) : id
}

export function TaxonomyHierarchyDndProvider({
  allNodes,
  onReparent,
  onReorder,
  children,
}: TaxonomyHierarchyDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeNodeId = activeId ? stripTaxonomyDragPrefix(activeId) : null
  const activeNode = activeNodeId ? findTaxonomyNode(allNodes, activeNodeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const itemId = stripTaxonomyDragPrefix(String(active.id))
    const overId = String(over.id)

    if (overId.startsWith('taxonomy-section-')) {
      const sectionKey = overId.replace('taxonomy-section-', '')
      onReparent(itemId, {
        type: 'root',
        sectionId: sectionKey === 'none' ? null : sectionKey,
      })
      return
    }

    // Nest into a folder droppable.
    if (overId.startsWith('taxonomy-drop-')) {
      const parentId = overId.replace('taxonomy-drop-', '')
      if (parentId === itemId) return
      onReparent(itemId, { type: 'node', parentId })
      return
    }

    // Sibling reorder via sortable collision with another item.
    if (overId.startsWith('taxonomy-') && overId !== String(active.id)) {
      const overItemId = stripTaxonomyDragPrefix(overId)
      if (overItemId === itemId) return
      onReorder?.(itemId, overItemId)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeNode ? (
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-lg">
            {activeNode.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export { taxonomyDragId, taxonomyDropId, taxonomySectionDropId }
