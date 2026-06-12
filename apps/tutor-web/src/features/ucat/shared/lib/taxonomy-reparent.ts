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

export type CategoryRowForSectionFilter = {
  id?: string | null
  parent_question_stem_category_id?: string | null
  ucat_section_id?: string | null
}

export type TagRowForSectionFilter = {
  id?: string | null
  parent_id?: string | null
  parent_question_tag_id?: string | null
  section_id?: string | null
  ucat_section_id?: string | null
}

function toCategoryTaxonomyRow(row: CategoryRowForSectionFilter & { id: string }): TaxonomyRowForReparent {
  return {
    id: row.id,
    parent_id: row.parent_question_stem_category_id ?? null,
    section_id: row.ucat_section_id ?? null,
  }
}

function toTaxonomyRowForSectionFilter(row: TagRowForSectionFilter & { id: string }): TaxonomyRowForReparent {
  return {
    id: row.id,
    parent_id: row.parent_id ?? row.parent_question_tag_id ?? null,
    section_id: row.section_id ?? row.ucat_section_id ?? null,
  }
}

function filterRowsByRootSections<T extends { id?: string | null }>(
  rows: T[],
  sectionIds: string[],
  toTaxonomyRow: (row: T & { id: string }) => TaxonomyRowForReparent
): T[] {
  const validRows = rows.filter(
    (row): row is T & { id: string } => typeof row.id === 'string' && row.id.length > 0
  )
  if (sectionIds.length === 0) return validRows
  const taxonomyRows = validRows.map(toTaxonomyRow)
  return validRows.filter((row) => {
    const rootSectionId = resolveRootSectionId(taxonomyRows, row.id)
    return rootSectionId === null || sectionIds.includes(rootSectionId)
  })
}

/** Categories whose root section is in `sectionIds`, or whose root has no section. */
export function filterCategoriesForSections<T extends CategoryRowForSectionFilter>(
  rows: T[],
  sectionIds: string[]
): T[] {
  return filterRowsByRootSections(rows, sectionIds, toCategoryTaxonomyRow)
}

/** Tags whose root section is in `sectionIds`, or whose root has no section. */
export function filterTagsForSections<T extends TagRowForSectionFilter>(
  rows: T[],
  sectionIds: string[]
): T[] {
  return filterRowsByRootSections(rows, sectionIds, toTaxonomyRowForSectionFilter)
}

/** Tags whose root section matches `sectionId`, or whose root has no section. */
export function filterTagsForImportSection<T extends TagRowForSectionFilter>(
  rows: T[],
  sectionId: string | null
): T[] {
  if (!sectionId) {
    return rows.filter((row): row is T & { id: string } => typeof row.id === 'string' && row.id.length > 0)
  }
  return filterTagsForSections(rows, [sectionId])
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
