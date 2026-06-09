'use client'

import { useEffect, useState } from 'react'
import {
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical } from 'lucide-react'
import { cn } from '@/shared/utils'

export type TaxonomyHierarchyNode = {
  id: string
  name: string
  child_count: number
  item_count: number
  children: TaxonomyHierarchyNode[]
}

export type TaxonomyReparentTarget =
  | { type: 'root'; sectionId: string | null }
  | { type: 'node'; parentId: string }

export const taxonomyDragId = (id: string) => `taxonomy-${id}`
export const taxonomyDropId = (id: string) => `taxonomy-drop-${id}`
export const taxonomySectionDropId = (sectionId: string | null) =>
  `taxonomy-section-${sectionId ?? 'none'}`

type TaxonomyHierarchyTreeProps = {
  nodes: TaxonomyHierarchyNode[]
  itemCountNoun: 'question' | 'stem'
  onItemClick: (id: string) => void
  searchQuery?: string
  className?: string
  editMode?: boolean
}

function formatItemCount(count: number, noun: 'question' | 'stem') {
  const plural = noun === 'question' ? 'questions' : 'stems'
  return `${count} ${count === 1 ? noun : plural}`
}

function CountBadges({
  childCount,
  itemCount,
  itemCountNoun,
}: {
  childCount: number
  itemCount: number
  itemCountNoun: 'question' | 'stem'
}) {
  const parts: string[] = []
  if (childCount > 0) {
    parts.push(`${childCount} ${childCount === 1 ? 'child' : 'children'}`)
  }
  parts.push(formatItemCount(itemCount, itemCountNoun))
  return (
    <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
      {parts.join(' · ')}
    </span>
  )
}

function nodeOrDescendantMatchesSearch(node: TaxonomyHierarchyNode, query: string): boolean {
  if (!query) return true
  if (node.name.toLowerCase().includes(query)) return true
  return node.children.some((child) => nodeOrDescendantMatchesSearch(child, query))
}

function TaxonomyHierarchyTreeNode({
  node,
  onItemClick,
  searchQuery,
  itemCountNoun,
  depth = 0,
  editMode = false,
}: {
  node: TaxonomyHierarchyNode
  onItemClick: (id: string) => void
  searchQuery: string
  itemCountNoun: 'question' | 'stem'
  depth?: number
  editMode?: boolean
}) {
  const hasChildren = node.children.length > 0
  const query = searchQuery.trim().toLowerCase()
  const matchesSearch = !query || node.name.toLowerCase().includes(query)
  const hasMatchingDescendant = node.children.some((child) =>
    nodeOrDescendantMatchesSearch(child, query)
  )
  const [expanded, setExpanded] = useState(depth === 0 || matchesSearch || hasMatchingDescendant)

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: taxonomyDragId(node.id),
    disabled: !editMode,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: taxonomyDropId(node.id),
    disabled: !editMode,
  })

  useEffect(() => {
    if (matchesSearch || hasMatchingDescendant) {
      setExpanded(true)
    }
  }, [hasMatchingDescendant, matchesSearch])

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <li className="rounded-lg">
      <div
        ref={setDropRef}
        className={cn(
          'flex items-center gap-1 rounded-lg py-0.5 pl-0 pr-1 transition-colors',
          editMode && isOver && 'bg-primary/10 ring-1 ring-primary/30'
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300',
            hasChildren ? 'hover:bg-muted/80' : 'cursor-default opacity-0'
          )}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-300 ease-out',
              expanded && 'rotate-90'
            )}
          />
        </button>

        {editMode ? (
          <button
            type="button"
            ref={setDragRef}
            style={dragStyle}
            className={cn(
              'flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 active:cursor-grabbing',
              isDragging && 'opacity-40'
            )}
            aria-label={`Drag ${node.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!editMode) onItemClick(node.id)
          }}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors duration-300',
            editMode ? 'cursor-default' : 'hover:bg-muted/80'
          )}
        >
          <span className="block min-w-0 flex-1 truncate" title={node.name}>
            {node.name}
          </span>
          <CountBadges
            childCount={node.child_count}
            itemCount={node.item_count}
            itemCountNoun={itemCountNoun}
          />
        </button>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-3">
              <TaxonomyHierarchyTree
                nodes={node.children}
                onItemClick={onItemClick}
                searchQuery={searchQuery}
                itemCountNoun={itemCountNoun}
                editMode={editMode}
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function TaxonomySectionDropZone({
  sectionId,
  sectionName,
  editMode,
  children,
  className,
}: {
  sectionId: string | null
  sectionName: string
  editMode: boolean
  children: React.ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: taxonomySectionDropId(sectionId),
    disabled: !editMode,
  })

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-5 sm:p-6',
        className
      )}
    >
      <h2
        ref={setNodeRef}
        className={cn(
          'mb-4 rounded-lg text-lg font-semibold tracking-tight transition-colors',
          editMode && 'px-2 py-1.5 -mx-2',
          editMode && isOver && 'bg-primary/10 ring-2 ring-primary/40'
        )}
      >
        {sectionName}
        {editMode ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Drop on heading to make a root {sectionId ? 'in this section' : 'tag'}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  )
}

export function TaxonomyHierarchyTree({
  nodes,
  itemCountNoun,
  onItemClick,
  searchQuery = '',
  className,
  editMode = false,
}: TaxonomyHierarchyTreeProps) {
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">Nothing in this section.</p>
  }

  return (
    <ul className={cn('space-y-0', className)}>
      {nodes.map((node) => (
        <TaxonomyHierarchyTreeNode
          key={node.id}
          node={node}
          onItemClick={onItemClick}
          searchQuery={searchQuery}
          itemCountNoun={itemCountNoun}
          editMode={editMode}
        />
      ))}
    </ul>
  )
}

export function findTaxonomyNode(
  nodes: TaxonomyHierarchyNode[],
  id: string
): TaxonomyHierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findTaxonomyNode(node.children, id)
    if (child) return child
  }
  return null
}
