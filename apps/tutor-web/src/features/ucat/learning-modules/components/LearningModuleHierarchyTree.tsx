'use client'

import { useEffect, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, ChevronRight, Folder, Globe, GripVertical, Lock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import {
  taxonomyDragId,
  taxonomyDropId,
} from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import type { UcatLearningModuleTreeNode } from '@/features/ucat/learning-modules/types/tree'
import { cn } from '@/shared/utils'

type LearningModuleHierarchyTreeProps = {
  nodes: UcatLearningModuleTreeNode[]
  onItemClick: (id: string) => void
  searchQuery?: string
  className?: string
  editMode?: boolean
}

function nodeOrDescendantMatchesSearch(node: UcatLearningModuleTreeNode, query: string): boolean {
  if (!query) return true
  if (node.title.toLowerCase().includes(query)) return true
  return node.children.some((child) => nodeOrDescendantMatchesSearch(child, query))
}

function KindIcon({ kind }: { kind: UcatLearningModuleTreeNode['kind'] }) {
  const Icon = kind === 'folder' ? Folder : BookOpen
  const label = kind === 'folder' ? 'Folder' : 'Lesson'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function PrivacyIcon({ isPrivate }: { isPrivate: boolean }) {
  const Icon = isPrivate ? Lock : Globe
  const label = isPrivate ? 'Private — visible only to assigned students' : 'Public — visible in the student library'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            isPrivate ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ContentCountBadge({ node }: { node: UcatLearningModuleTreeNode }) {
  const label =
    node.kind === 'folder'
      ? `${node.child_count} ${node.child_count === 1 ? 'child' : 'children'}`
      : `${node.block_count} ${node.block_count === 1 ? 'block' : 'blocks'}`

  return (
    <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
      {label}
    </span>
  )
}

function LearningModuleHierarchyTreeNode({
  node,
  onItemClick,
  searchQuery,
  depth = 0,
  editMode = false,
}: {
  node: UcatLearningModuleTreeNode
  onItemClick: (id: string) => void
  searchQuery: string
  depth?: number
  editMode?: boolean
}) {
  const hasChildren = node.children.length > 0
  const query = searchQuery.trim().toLowerCase()
  const matchesSearch = !query || node.title.toLowerCase().includes(query)
  const hasMatchingDescendant = node.children.some((child) =>
    nodeOrDescendantMatchesSearch(child, query),
  )
  const [expanded, setExpanded] = useState(depth === 0 || matchesSearch || hasMatchingDescendant)

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: taxonomyDragId(node.id),
    disabled: !editMode,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: taxonomyDropId(node.id),
    disabled: !editMode || node.kind !== 'folder',
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
          editMode && isOver && node.kind === 'folder' && 'bg-primary/10 ring-1 ring-primary/30',
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300',
            hasChildren ? 'hover:bg-muted/80' : 'cursor-default opacity-0',
          )}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-300 ease-out',
              expanded && 'rotate-90',
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
              isDragging && 'opacity-40',
            )}
            aria-label={`Drag ${node.title}`}
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
            editMode ? 'cursor-default' : 'hover:bg-muted/80',
          )}
        >
          <KindIcon kind={node.kind} />
          <PrivacyIcon isPrivate={node.is_private} />
          <span className="block min-w-0 flex-1 truncate" title={node.title}>
            {node.title}
          </span>
          <ContentCountBadge node={node} />
        </button>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-3">
              <LearningModuleHierarchyTree
                nodes={node.children}
                onItemClick={onItemClick}
                searchQuery={searchQuery}
                editMode={editMode}
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function LearningModuleHierarchyTree({
  nodes,
  onItemClick,
  searchQuery = '',
  className,
  editMode = false,
}: LearningModuleHierarchyTreeProps) {
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">Nothing in this section.</p>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ul className={cn('space-y-0', className)}>
        {nodes.map((node) => (
          <LearningModuleHierarchyTreeNode
            key={node.id}
            node={node}
            onItemClick={onItemClick}
            searchQuery={searchQuery}
            editMode={editMode}
          />
        ))}
      </ul>
    </TooltipProvider>
  )
}
