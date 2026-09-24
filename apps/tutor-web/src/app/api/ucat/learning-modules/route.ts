import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const isCreate = !body.moduleId

    const { data, error } = await client.rpc('tutor_ucat_upsert_learning_module', {
      p_module_id: body.moduleId ?? null,
      p_kind: body.kind,
      p_title: body.title,
      p_description: body.description ?? null,
      p_ucat_section_id: body.ucatSectionId ?? null,
      p_parent_id: body.parentId ?? null,
      p_index: isCreate ? (body.index ?? null) : (body.index ?? 0),
      p_access_scope: body.accessScope ?? 'public',
      p_icon_key: body.iconKey ?? 'book-open',
      p_estimated_minutes: body.estimatedMinutes ?? null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const moduleId = data as string
    const { error: metadataError } = await client.rpc(
      'tutor_ucat_update_learning_module_study_plan_metadata',
      {
        p_learning_module_id: moduleId,
        p_priority: body.studyPlanPriority ?? 'recommended',
        p_category_ids: body.studyPlanCategoryIds ?? [],
        p_tag_ids: body.studyPlanTagIds ?? [],
      },
    )
    if (metadataError) return NextResponse.json({ error: metadataError.message }, { status: 400 })
    return NextResponse.json({ id: moduleId })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
