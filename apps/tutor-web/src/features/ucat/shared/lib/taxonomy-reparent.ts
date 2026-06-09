export type TaxonomyRowForReparent = {
  id: string
  parent_id: string | null
  section_id?: string | null
}

export function isDescendantOf(
  rows: TaxonomyRowForReparent[],
  candidateId: string,
  ancestorId: string
): boolean {
  const byId = new Map(rows.map((row) => [row.id, row]))
  let current = byId.get(candidateId)
  const visited = new Set<string>()
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true
    if (visited.has(current.parent_id)) break
    visited.add(current.parent_id)
    current = byId.get(current.parent_id)
  }
  return false
}

export function resolveRootSectionId(
  rows: TaxonomyRowForReparent[],
  nodeId: string
): string | null {
  const byId = new Map(rows.map((row) => [row.id, row]))
  let current = byId.get(nodeId)
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    if (current.parent_id === null) {
      return current.section_id ?? null
    }
    current = byId.get(current.parent_id)
  }
  return null
}

export function collectDescendantIds(
  rows: TaxonomyRowForReparent[],
  rootId: string
): string[] {
  const childrenByParent = new Map<string | null, string[]>()
  for (const row of rows) {
    const parentKey = row.parent_id
    const list = childrenByParent.get(parentKey) ?? []
    list.push(row.id)
    childrenByParent.set(parentKey, list)
  }

  const result: string[] = []
  const stack = [...(childrenByParent.get(rootId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()!
    result.push(id)
    stack.push(...(childrenByParent.get(id) ?? []))
  }
  return result
}
