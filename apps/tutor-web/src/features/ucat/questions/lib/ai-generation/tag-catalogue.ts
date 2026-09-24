import type { AiGenerationTag } from './prompts'

export type AiGenerationTagRow = {
  id: string
  name: string
  description: string | null
  parentId: string | null
  sectionId: string | null
}

function resolveSectionId(
  tag: AiGenerationTagRow,
  tagsById: Map<string, AiGenerationTagRow>,
): string | null {
  const visited = new Set<string>()
  let current: AiGenerationTagRow | undefined = tag
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (current.sectionId) return current.sectionId
    current = current.parentId ? tagsById.get(current.parentId) : undefined
  }
  return null
}

function resolvePath(
  tag: AiGenerationTagRow,
  tagsById: Map<string, AiGenerationTagRow>,
): string {
  const names: string[] = []
  const visited = new Set<string>()
  let current: AiGenerationTagRow | undefined = tag
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? tagsById.get(current.parentId) : undefined
  }
  return names.join(' / ')
}

export function buildAiGenerationTagCatalogue(
  rows: AiGenerationTagRow[],
  sectionId: string,
): AiGenerationTag[] {
  const tagsById = new Map(rows.map((tag) => [tag.id, tag]))
  return rows
    .filter((tag) => resolveSectionId(tag, tagsById) === sectionId)
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      path: resolvePath(tag, tagsById),
      description: tag.description,
      parentId: tag.parentId,
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}
