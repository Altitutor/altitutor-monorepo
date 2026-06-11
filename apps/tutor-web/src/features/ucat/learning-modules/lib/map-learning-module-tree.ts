import type { UcatLearningModuleTreeNode } from '@/features/ucat/learning-modules/types/tree'
import type { TaxonomyHierarchyNode } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'

export function mapLearningModuleTreeToTaxonomyNodes(
  nodes: UcatLearningModuleTreeNode[],
): TaxonomyHierarchyNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.title,
    child_count: node.children.length,
    item_count: node.kind === 'folder' ? node.child_count : node.block_count,
    children: mapLearningModuleTreeToTaxonomyNodes(node.children),
  }))
}

export function flattenLearningModuleTreeNodes(
  nodes: UcatLearningModuleTreeNode[],
): UcatLearningModuleTreeNode[] {
  const result: UcatLearningModuleTreeNode[] = []
  const walk = (list: UcatLearningModuleTreeNode[]) => {
    for (const node of list) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}
