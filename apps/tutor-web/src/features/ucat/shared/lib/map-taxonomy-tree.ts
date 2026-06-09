import type { TaxonomyHierarchyNode } from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'

type SourceNode = {
  id: string
  name: string
  child_count: number
  question_count?: number
  question_stem_count?: number
  children: SourceNode[]
}

export function mapToTaxonomyHierarchyNodes(
  nodes: SourceNode[],
  itemCountKey: 'question_count' | 'question_stem_count'
): TaxonomyHierarchyNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    child_count: node.child_count,
    item_count: itemCountKey === 'question_count' ? (node.question_count ?? 0) : (node.question_stem_count ?? 0),
    children: mapToTaxonomyHierarchyNodes(node.children, itemCountKey),
  }))
}

export function flattenTaxonomyHierarchyNodes(nodes: TaxonomyHierarchyNode[]): TaxonomyHierarchyNode[] {
  const result: TaxonomyHierarchyNode[] = []
  const walk = (list: TaxonomyHierarchyNode[]) => {
    for (const node of list) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}
