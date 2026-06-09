import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import type { UcatLearningModuleTreeNode } from '@/features/ucat/learning-modules/types/tree'
import { resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'

function buildModuleTreeNodes(
  rows: UcatLearningModuleRow[],
  parentId: string | null,
): UcatLearningModuleTreeNode[] {
  return rows
    .filter((row) => row.parent_ucat_learning_module_id === parentId)
    .sort((a, b) => a.index - b.index || a.title.localeCompare(b.title))
    .map((row) => {
      const children = buildModuleTreeNodes(rows, row.id)
      return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        is_private: row.is_private,
        child_count: row.child_count,
        block_count: row.block_count,
        children,
      }
    })
}

export function buildModuleSectionTreeNodes(
  rows: UcatLearningModuleRow[],
  sectionId: string | null,
): UcatLearningModuleTreeNode[] {
  const taxonomyRows = rows.map((row) => ({
    id: row.id,
    parent_id: row.parent_ucat_learning_module_id,
    section_id: row.ucat_section_id,
  }))

  const sectionRows = rows.filter(
    (row) => resolveRootSectionId(taxonomyRows, row.id) === sectionId,
  )
  const ids = new Set(sectionRows.map((row) => row.id))
  const roots = sectionRows
    .filter(
      (row) =>
        row.parent_ucat_learning_module_id === null || !ids.has(row.parent_ucat_learning_module_id),
    )
    .sort((a, b) => a.index - b.index || a.title.localeCompare(b.title))

  return roots.map((row) => {
    const children = buildModuleTreeNodes(sectionRows, row.id)
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      is_private: row.is_private,
      child_count: row.child_count,
      block_count: row.block_count,
      children,
    }
  })
}

export function filterModuleTreeNodes(
  nodes: UcatLearningModuleTreeNode[],
  search: string,
): UcatLearningModuleTreeNode[] {
  const query = search.trim().toLowerCase()
  if (!query) return nodes

  return nodes
    .map((node) => {
      const filteredChildren = filterModuleTreeNodes(node.children, search)
      if (node.title.toLowerCase().includes(query) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter((node): node is UcatLearningModuleTreeNode => node !== null)
}
