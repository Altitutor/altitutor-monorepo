'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { UcatQuestionStemCategoryTreeNode } from '@/features/ucat/question-stem-categories/types'

type CategoryHierarchyTreeProps = {
  nodes: UcatQuestionStemCategoryTreeNode[]
  onCategoryClick: (categoryId: string) => void
  searchQuery?: string
  className?: string
}

function CountBadges({ childCount, stemCount }: { childCount: number; stemCount: number }) {
  const parts: string[] = []
  if (childCount > 0) {
    parts.push(`${childCount} ${childCount === 1 ? 'child' : 'children'}`)
  }
  parts.push(`${stemCount} ${stemCount === 1 ? 'stem' : 'stems'}`)
  return (
    <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
      {parts.join(' · ')}
    </span>
  )
}

function categoryNodeOrDescendantMatchesSearch(
  node: UcatQuestionStemCategoryTreeNode,
  query: string
): boolean {
  if (!query) return true
  if (node.name.toLowerCase().includes(query)) return true
  return node.children.some((child) => categoryNodeOrDescendantMatchesSearch(child, query))
}

function CategoryHierarchyTreeNode({
  node,
  onCategoryClick,
  searchQuery,
  depth = 0,
}: {
  node: UcatQuestionStemCategoryTreeNode
  onCategoryClick: (categoryId: string) => void
  searchQuery: string
  depth?: number
}) {
  const hasChildren = node.children.length > 0
  const query = searchQuery.trim().toLowerCase()
  const matchesSearch = !query || node.name.toLowerCase().includes(query)
  const hasMatchingDescendant = node.children.some((child) =>
    categoryNodeOrDescendantMatchesSearch(child, query)
  )
  const [expanded, setExpanded] = useState(depth === 0 || matchesSearch || hasMatchingDescendant)

  useEffect(() => {
    if (matchesSearch || hasMatchingDescendant) {
      setExpanded(true)
    }
  }, [hasMatchingDescendant, matchesSearch])

  return (
    <li className="rounded-lg">
      <div className="flex items-center gap-1 py-0.5 pl-0 pr-1">
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

        <button
          type="button"
          onClick={() => onCategoryClick(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors duration-300 hover:bg-muted/80"
        >
          <span className="block min-w-0 flex-1 truncate" title={node.name}>
            {node.name}
          </span>
          <CountBadges childCount={node.child_count} stemCount={node.question_stem_count} />
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
              <CategoryHierarchyTree
                nodes={node.children}
                onCategoryClick={onCategoryClick}
                searchQuery={searchQuery}
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function CategoryHierarchyTree({
  nodes,
  onCategoryClick,
  searchQuery = '',
  className,
}: CategoryHierarchyTreeProps) {
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">No categories in this section.</p>
  }

  return (
    <ul className={cn('space-y-0', className)}>
      {nodes.map((node) => (
        <CategoryHierarchyTreeNode
          key={node.id}
          node={node}
          onCategoryClick={onCategoryClick}
          searchQuery={searchQuery}
        />
      ))}
    </ul>
  )
}
