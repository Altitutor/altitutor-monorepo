import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  assertCategoryParentValid,
  cascadeCategorySection,
} from '@/features/ucat/shared/server/taxonomy-mutations'

function toRichText(text?: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text
          ? [
              {
                type: 'text',
                text,
              },
            ]
          : [],
      },
    ],
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const { data: staffId } = await access.userClient.rpc('current_tutor_id')
    const service = getServiceRoleClient()

    const { data: existing } = await service
      .from('question_stem_categories')
      .select('parent_question_stem_category_id, ucat_section_id')
      .eq('id', params.id)
      .single()

    let parentCategoryId =
      body.parentCategoryId !== undefined
        ? body.parentCategoryId || null
        : existing?.parent_question_stem_category_id ?? null
    let sectionId =
      body.sectionId !== undefined ? body.sectionId || null : existing?.ucat_section_id ?? null

    if (body.reparentOnly) {
      parentCategoryId = body.parentCategoryId ?? null
      if (parentCategoryId) {
        const { data: parent } = await service
          .from('question_stem_categories')
          .select('ucat_section_id')
          .eq('id', parentCategoryId)
          .maybeSingle()
        sectionId = parent?.ucat_section_id ?? null
      } else {
        sectionId = body.sectionId ?? null
      }
    } else if (parentCategoryId) {
      const { data: parent } = await service
        .from('question_stem_categories')
        .select('ucat_section_id')
        .eq('id', parentCategoryId)
        .maybeSingle()
      sectionId = parent?.ucat_section_id ?? sectionId
    }

    if (parentCategoryId) {
      const parentError = await assertCategoryParentValid(
        service,
        params.id,
        parentCategoryId
      )
      if (parentError) {
        return NextResponse.json({ error: parentError }, { status: 400 })
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_by: staffId,
    }

    if (!body.reparentOnly) {
      if (body.name !== undefined) updatePayload.name = body.name
      if (body.description !== undefined) {
        updatePayload.description = toRichText(body.description)
      }
    }

    if (body.parentCategoryId !== undefined || body.reparentOnly) {
      updatePayload.parent_question_stem_category_id = parentCategoryId
    }
    if (body.sectionId !== undefined || body.reparentOnly || parentCategoryId) {
      updatePayload.ucat_section_id = sectionId
    }

    const { data, error } = await service
      .from('question_stem_categories')
      .update(updatePayload)
      .eq('id', params.id)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (sectionId !== existing?.ucat_section_id) {
      await cascadeCategorySection(service, params.id, sectionId, staffId)
    }

    return NextResponse.json({ id: data.id })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const service = getServiceRoleClient()
  const { error } = await service.from('question_stem_categories').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
