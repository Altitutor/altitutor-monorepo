import type { UcatQuestionTagRow, UcatQuestionTagTreeNode } from '@/features/ucat/question-tags/types'

export function buildTagTreeNodes(
  rows: UcatQuestionTagRow[],
  parentId: string | null
): UcatQuestionTagTreeNode[] {
  return rows
    .filter((row) => row.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const children = buildTagTreeNodes(rows, row.id)
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        parent_id: row.parent_id,
        question_count: row.question_count,
        child_count: children.length,
        children,
      }
    })
}

export function getRootTags(rows: UcatQuestionTagRow[]): UcatQuestionTagRow[] {
  const ids = new Set(rows.map((row) => row.id))
  return rows
    .filter((row) => row.parent_id === null || !ids.has(row.parent_id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function tagTreeNodeMatchesSearch(node: UcatQuestionTagTreeNode, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  if (node.name.toLowerCase().includes(query)) return true
  return node.children.some((child) => tagTreeNodeMatchesSearch(child, query))
}

export function filterTagTreeNodes(
  nodes: UcatQuestionTagTreeNode[],
  search: string
): UcatQuestionTagTreeNode[] {
  const query = search.trim().toLowerCase()
  if (!query) return nodes

  return nodes
    .map((node) => {
      const filteredChildren = filterTagTreeNodes(node.children, search)
      if (node.name.toLowerCase().includes(query) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter((node): node is UcatQuestionTagTreeNode => node !== null)
}
