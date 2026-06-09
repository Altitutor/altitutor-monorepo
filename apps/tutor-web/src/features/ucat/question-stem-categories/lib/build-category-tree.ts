import type {
  UcatQuestionStemCategoryRow,
  UcatQuestionStemCategoryTreeNode,
} from '@/features/ucat/question-stem-categories/types'

export function buildCategoryTreeNodes(
  rows: UcatQuestionStemCategoryRow[],
  parentId: string | null
): UcatQuestionStemCategoryTreeNode[] {
  return rows
    .filter((row) => row.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const children = buildCategoryTreeNodes(rows, row.id)
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        parent_id: row.parent_id,
        question_stem_count: row.question_stem_count,
        child_count: children.length,
        children,
      }
    })
}

export function filterCategoryTreeNodes(
  nodes: UcatQuestionStemCategoryTreeNode[],
  search: string
): UcatQuestionStemCategoryTreeNode[] {
  const query = search.trim().toLowerCase()
  if (!query) return nodes

  return nodes
    .map((node) => {
      const filteredChildren = filterCategoryTreeNodes(node.children, search)
      if (node.name.toLowerCase().includes(query) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter((node): node is UcatQuestionStemCategoryTreeNode => node !== null)
}
