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
  children: React.ReactNode
}

export function TaxonomyHierarchyDndProvider({
  allNodes,
  onReparent,
  children,
}: TaxonomyHierarchyDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeNodeId = activeId?.replace('taxonomy-', '') ?? null
  const activeNode = activeNodeId ? findTaxonomyNode(allNodes, activeNodeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const itemId = String(active.id).replace('taxonomy-', '')
    const overId = String(over.id)

    if (overId.startsWith('taxonomy-section-')) {
      const sectionKey = overId.replace('taxonomy-section-', '')
      onReparent(itemId, {
        type: 'root',
        sectionId: sectionKey === 'none' ? null : sectionKey,
      })
      return
    }

    if (overId.startsWith('taxonomy-drop-')) {
      const parentId = overId.replace('taxonomy-drop-', '')
      if (parentId === itemId) return
      onReparent(itemId, { type: 'node', parentId })
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
