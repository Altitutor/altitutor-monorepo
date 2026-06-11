import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'

export type TaxonomyNode = {
  id: string
  name: string
  parentId: string | null
}

const PATH_SEPARATOR = ' / '

export function taxonomyDisplayLabel(item: {
  name?: string | null
  label?: string | null
}): string {
  return item.label ?? item.name ?? 'Untitled'
}

export function buildTaxonomyPathLookup(nodes: TaxonomyNode[]): Map<string, string> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const cache = new Map<string, string>()

  const pathFor = (id: string): string => {
    const cached = cache.get(id)
    if (cached !== undefined) return cached

    const chain: string[] = []
    let current = byId.get(id)
    const visited = new Set<string>()
    while (current) {
      if (visited.has(current.id)) break
      visited.add(current.id)
      chain.unshift(current.name)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    const path = chain.join(PATH_SEPARATOR)
    cache.set(id, path)
    return path
  }

  for (const node of nodes) {
    pathFor(node.id)
  }
  return cache
}

export function categoriesToTaxonomyNodes(
  rows: Array<{
    id?: string | null
    name?: string | null
    parent_question_stem_category_id?: string | null
  }>
): TaxonomyNode[] {
  return rows
    .filter((row): row is typeof row & { id: string; name: string } => !!row.id && !!row.name)
    .map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_question_stem_category_id ?? null,
    }))
}

export function tagsToTaxonomyNodes(
  rows: Array<{
    id?: string | null
    name?: string | null
    parent_question_tag_id?: string | null
  }>
): TaxonomyNode[] {
  return rows
    .filter((row): row is typeof row & { id: string; name: string } => !!row.id && !!row.name)
    .map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_question_tag_id ?? null,
    }))
}

export function mapCategoriesToOptions(
  rows: Array<{
    id?: string | null
    name?: string | null
    ucat_section_id?: string | null
    parent_question_stem_category_id?: string | null
  }>
): CategoryOption[] {
  const paths = buildTaxonomyPathLookup(categoriesToTaxonomyNodes(rows))
  return rows
    .filter((row): row is typeof row & { id: string } => !!row.id)
    .map((row) => ({
      id: row.id,
      name: row.name ?? null,
      ucat_section_id: row.ucat_section_id,
      label: paths.get(row.id) ?? row.name ?? 'Untitled',
    }))
}

export function mapTagsToOptions(
  rows: Array<{
    id?: string | null
    name?: string | null
    parent_question_tag_id?: string | null
  }>
): TagOption[] {
  const paths = buildTaxonomyPathLookup(tagsToTaxonomyNodes(rows))
  return rows
    .filter((row): row is typeof row & { id: string } => !!row.id)
    .map((row) => ({
      id: row.id,
      name: row.name ?? '',
      label: paths.get(row.id) ?? row.name ?? 'Untitled',
    }))
}

export function resolveCategoryPathLabel(
  lookup: Map<string, string>,
  categoryId: string | null | undefined,
  fallbackName?: string | null
): string {
  if (categoryId && lookup.has(categoryId)) return lookup.get(categoryId)!
  return fallbackName ?? '—'
}

export function resolveTagPathLabel(
  lookup: Map<string, string>,
  tagId: string,
  fallbackName?: string | null
): string {
  if (lookup.has(tagId)) return lookup.get(tagId)!
  return fallbackName ?? 'Untitled'
}
