import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'

type ServiceClient = SupabaseClient<Database>

export async function assertTagParentValid(
  service: ServiceClient,
  tagId: string,
  parentTagId: string | null
): Promise<string | null> {
  if (!parentTagId) return null
  if (parentTagId === tagId) return 'A tag cannot be its own parent'

  const { data: parent, error } = await service
    .from('question_tags')
    .select('id, parent_question_tag_id')
    .eq('id', parentTagId)
    .maybeSingle()

  if (error) return error.message
  if (!parent) return 'Parent tag not found'

  let currentId: string | null = parent.parent_question_tag_id
  const visited = new Set<string>([parentTagId])
  while (currentId) {
    if (currentId === tagId) return 'Cannot create a circular tag hierarchy'
    if (visited.has(currentId)) break
    visited.add(currentId)
    const { data: ancestor } = await service
      .from('question_tags')
      .select('parent_question_tag_id')
      .eq('id', currentId)
      .maybeSingle()
    currentId = ancestor?.parent_question_tag_id ?? null
  }

  return null
}

export async function cascadeCategorySection(
  service: ServiceClient,
  categoryId: string,
  sectionId: string | null,
  staffId: string | null
): Promise<void> {
  const { data: children, error } = await service
    .from('question_stem_categories')
    .select('id')
    .eq('parent_question_stem_category_id', categoryId)

  if (error || !children?.length) return

  for (const child of children) {
    if (!child.id) continue
    await service
      .from('question_stem_categories')
      .update({
        ucat_section_id: sectionId,
        updated_by: staffId,
      })
      .eq('id', child.id)
    await cascadeCategorySection(service, child.id, sectionId, staffId)
  }
}

export async function assertCategoryParentValid(
  service: ServiceClient,
  categoryId: string,
  parentCategoryId: string | null
): Promise<string | null> {
  if (!parentCategoryId) return null
  if (parentCategoryId === categoryId) return 'A category cannot be its own parent'

  const { data: parent, error } = await service
    .from('question_stem_categories')
    .select('id, parent_question_stem_category_id')
    .eq('id', parentCategoryId)
    .maybeSingle()

  if (error) return error.message
  if (!parent) return 'Parent category not found'

  let currentId: string | null = parent.parent_question_stem_category_id
  const visited = new Set<string>([parentCategoryId])
  while (currentId) {
    if (currentId === categoryId) return 'Cannot create a circular category hierarchy'
    if (visited.has(currentId)) break
    visited.add(currentId)
    const { data: ancestor } = await service
      .from('question_stem_categories')
      .select('parent_question_stem_category_id')
      .eq('id', currentId)
      .maybeSingle()
    currentId = ancestor?.parent_question_stem_category_id ?? null
  }

  return null
}
